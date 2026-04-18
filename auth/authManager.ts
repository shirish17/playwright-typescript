import { chromium, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { UserConfig, EnvLoader } from "@config/envLoader.js";

export interface StorageStateKey {
  environment: string;
  username: string;
  tenant: string;
}

export class AuthManager {
  private static rootDir = process.cwd();

  private static storageStateDir = path.resolve(
    AuthManager.rootDir,
    "auth",
    "storageStates",
  );

  private static lockDir = path.join(this.storageStateDir, ".locks");

  private static storageStateTTL = 24 * 60 * 60 * 1000;

  // -------------------------
  // INIT
  // -------------------------
  static init(): void {
    fs.mkdirSync(this.storageStateDir, { recursive: true });
    fs.mkdirSync(this.lockDir, { recursive: true });

    ["dev", "val", "uat"].forEach((env) => {
      fs.mkdirSync(path.join(this.storageStateDir, env), { recursive: true });
    });
  }

  private static getStorageStatePath(key: StorageStateKey): string {
    return path.join(
      this.storageStateDir,
      key.environment.toLowerCase(),
      `${key.username.replace(/[^a-zA-Z0-9]/g, "_")}-${key.tenant}.json`,
    );
  }

  private static getLockPath(key: StorageStateKey): string {
    return path.join(
      this.lockDir,
      `${key.environment}-${key.username}-${key.tenant}.lock`,
    );
  }

  private static async acquireLock(key: StorageStateKey): Promise<() => void> {
    const lockFile = this.getLockPath(key);
    const start = Date.now();

    while (true) {
      try {
        fs.writeFileSync(lockFile, `${process.pid}`, { flag: "wx" });
        return () => fs.unlinkSync(lockFile);
      } catch {
        if (Date.now() - start > 120_000) {
          throw new Error(`❌ Auth lock timeout for ${key.username}`);
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  // -------------------------
  // STORAGE VALIDATION
  // -------------------------
  static isStorageStateFileValid(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;

    const stats = fs.statSync(filePath);
    if (Date.now() - stats.mtimeMs > this.storageStateTTL) return false;

    try {
      const state = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return Array.isArray(state.cookies) && state.cookies.length > 0;
    } catch {
      return false;
    }
  }

  // -------------------------
  // SESSION SMOKE CHECK
  // -------------------------
  private static async isSessionStillAuthenticated(
    storageStatePath: string,
  ): Promise<boolean> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: storageStatePath,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    await page.goto(EnvLoader.getBaseUrl(), { waitUntil: "domcontentloaded" });

    // Session is invalid if redirected to ADFS
    const onAdfs = page.url().includes("adfs");
    await context.close();
    await browser.close();

    return !onAdfs;
  }

  // -------------------------
  // TENANT RESOLUTION
  // Called in TWO places:
  // 1. During fresh login (getOrCreateStorageState)
  // 2. During session reuse (authPage fixture in ctmsExecutionContext)
  // -------------------------
  static async resolveTenantIfRequired(
    page: Page,
    tenant: string,
  ): Promise<void> {
    console.log(`🔍 resolveTenantIfRequired called for tenant: ${tenant}`);
    console.log(`🔍 current URL: ${page.url()}`);

    // ─── PHASE A: Dismiss any blocking overlay/popup first ────────────────────
    await page
      .evaluate(() => {
        const closeIcons = Array.from(
          document.querySelectorAll(
            ".overlay .closeIcon, .popup .closeIcon, .overlay .close, .popup .close",
          ),
        );
        closeIcons.forEach((el) => (el as HTMLElement).click());
      })
      .catch(() => {});

    // Wait for non-tenant overlays to clear
    await page
      .waitForFunction(
        () => {
          const overlays = Array.from(document.querySelectorAll(".overlay"));
          return overlays.every((el) => {
            if (el.querySelector("button.btn-finish")) return true;
            const rect = (el as HTMLElement).getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return (
              style.display === "none" ||
              style.visibility === "hidden" ||
              rect.height === 0
            );
          });
        },
        { timeout: 10_000 },
      )
      .catch(() => {});

    // ─── PHASE B: Check for tenant chooser popup ──────────────────────────────
    const tenantOverlay = page.locator(".overlay").filter({
      has: page.locator("button.btn-finish"),
    });

    const tenantPopupVisible = await tenantOverlay
      .waitFor({ state: "visible", timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    console.log(`🔍 tenantPopupVisible: ${tenantPopupVisible}`);

    if (!tenantPopupVisible) {
      console.log(`✅ No tenant chooser — single tenant or already resolved`);
      return;
    }

    // ─── PHASE C: Find and click correct tenant row ───────────────────────────
    const tenantRow = tenantOverlay
      .locator("div.divWrap:not(.headerWrap)")
      .filter({ hasText: tenant });

    const rowCount = await tenantRow.count();
    console.log(`🔍 tenant rows found: ${rowCount}`);

    if (rowCount !== 1) {
      throw new Error(
        `❌ Expected exactly 1 tenant row for '${tenant}', found ${rowCount}`,
      );
    }

    const chooseButton = tenantRow.locator("button.btn-finish").first();

    try {
      await chooseButton.click({ timeout: 5_000 });
      console.log(`✅ standard click succeeded`);
    } catch (e) {
      console.warn(`⚠️ standard click failed — using dispatchEvent: ${e}`);
      await chooseButton.dispatchEvent("click");
      console.log(`✅ dispatchEvent fired`);
    }

    // ─── PHASE D: Wait for overlay to disappear ───────────────────────────────
    await page
      .waitForFunction(
        () => {
          const overlay = document.querySelector(".overlay");
          if (!overlay) return true;
          const rect = (overlay as HTMLElement).getBoundingClientRect();
          const style = window.getComputedStyle(overlay);
          return (
            style.display === "none" ||
            style.visibility === "hidden" ||
            rect.height === 0
          );
        },
        { timeout: 10_000 },
      )
      .catch(() => {});

    console.log(`✅ tenant resolved — overlay gone`);
  }

  // -------------------------
  // LOGIN (AUTHORITATIVE)
  // ADFS flow — always 3 pages in sequence:
  // 1. baseUrl → ADFS provider selection
  // 2. Click Active Directory → username/password form
  // 3. Submit credentials → redirect back to app
  // Storage state saved ONLY after confirmed app landing
  // -------------------------
  static async getOrCreateStorageState(user: UserConfig): Promise<string> {
    this.init();

    const key: StorageStateKey = {
      environment: EnvLoader.getEnvironment(),
      username: user.username,
      tenant: user.tenant,
    };

    const storagePath = this.getStorageStatePath(key);
    const release = await this.acquireLock(key);

    try {
      if (this.isStorageStateFileValid(storagePath)) {
        const stillValid = await this.isSessionStillAuthenticated(storagePath);
        if (stillValid) {
          return storagePath;
        }
        fs.unlinkSync(storagePath);
      }

      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      try {
        // ─── Page 1: Navigate to app → ADFS redirect ──────────────────────────
        await page.goto(EnvLoader.getBaseUrl(), { waitUntil: "networkidle" });

        // ─── Page 2: ADFS provider selection ──────────────────────────────────
        // Wait for ADFS URL before interacting
        await page.waitForURL((url) => url.hostname.includes("adfs"), {
          timeout: 30_000,
        });
        // DOM confirmed: div.idp[aria-label="Active Directory"] role="button"
        const adButton = page.locator('div.idp[aria-label="Active Directory"]');
        await adButton.waitFor({ state: "visible", timeout: 30_000 });
        await adButton.click();
        console.log(`✅ Active Directory clicked`);

        // ─── Page 3: Username/password form ───────────────────────────────────
        // DOM confirmed: div#userNameArea input, div#passwordArea input
        await page
          .locator("div#userNameArea input")
          .waitFor({ state: "visible", timeout: 30_000 });
        await page.locator("div#userNameArea input").fill(user.username);
        await page.locator("div#passwordArea input").fill(user.password);
        console.log(`✅ Credentials filled for: ${user.username}`);

        // DOM confirmed: form#loginForm — submit directly
        // Login.submitLoginRequest() is NOT on window — form.submit() is reliable
        await page.evaluate(() => {
          const form = document.getElementById("loginForm") as HTMLFormElement;
          if (form) form.submit();
        });
        console.log(`✅ Form submitted`);

        // ─── Wait for redirect back to app ────────────────────────────────────
        // Storage state MUST only be saved after landing on app domain
        await page.waitForURL(
          (url) => url.hostname === new URL(EnvLoader.getBaseUrl()).hostname,
          { timeout: 60_000 },
        );
        await page.waitForLoadState("networkidle");
        console.log(`✅ Redirected to app: ${page.url()}`);

        // ─── Resolve tenant if required ───────────────────────────────────────
        await this.resolveTenantIfRequired(page, user.tenant);

        // ─── Save storage state ONLY after app landing + tenant resolved ──────
        await context.storageState({ path: storagePath });
        console.log(`✅ Storage state saved: ${storagePath}`);
        return storagePath;
      } finally {
        await context.close();
        await browser.close();
      }
    } finally {
      release();
    }
  }
}
