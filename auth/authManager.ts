import { chromium, FullConfig, Page, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { UserCredentials } from "../config/users.config";
import { envConfig } from "../config/envLoader";
import { log } from "../tests/helpers/logger";

export class AuthManager {
  private static lockDir = path.join(__dirname, "storageStates", ".locks");
  private static maxLockWaitTime = 120000; // 2 minutes
  private static lockCheckInterval = 500; // Check every 500ms

  /**
   * Ensures storage state directory exists
   */
  static ensureStorageStateDir(): void {
    const storageDir = path.join(__dirname, "storageStates");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.lockDir)) {
      fs.mkdirSync(this.lockDir, { recursive: true });
    }
  }

  /**
   * Acquires an atomic lock for a specific user
   * Uses filesystem as lock mechanism (works across processes)
   */
  private static async acquireLock(userKey: string): Promise<() => void> {
    const lockFile = path.join(this.lockDir, `${userKey}.lock`);
    const startTime = Date.now();

    while (true) {
      try {
        // Try to create lock file exclusively (atomic operation)
        fs.writeFileSync(lockFile, process.pid.toString(), { flag: "wx" });

        // Return release function
        return () => {
          try {
            fs.unlinkSync(lockFile);
          } catch (e) {
            // Lock file already deleted, ignore
          }
        };
      } catch (error: any) {
        // Lock exists, check if it's stale
        if (error.code === "EEXIST") {
          const elapsed = Date.now() - startTime;

          if (elapsed > this.maxLockWaitTime) {
            // Force release stale lock
            console.warn(`⚠️  Force releasing stale lock for ${userKey}`);
            try {
              fs.unlinkSync(lockFile);
            } catch {}
            continue;
          }

          // Wait and retry
          await new Promise((resolve) =>
            setTimeout(resolve, this.lockCheckInterval),
          );
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Checks if storage state is valid
   */
  static isStorageStateValid(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      const fileAge = Date.now() - stats.mtimeMs;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (fileAge > maxAge) {
        console.log(`🔄 Storage state expired for ${path.basename(filePath)}`);
        return false;
      }

      const content = fs.readFileSync(filePath, "utf-8");
      const state = JSON.parse(content);

      // Validate structure
      if (!state.cookies || !Array.isArray(state.cookies)) {
        return false;
      }

      // Check if cookies are expired
      const now = Date.now() / 1000;
      const hasValidCookies = state.cookies.some((cookie: any) => {
        return !cookie.expires || cookie.expires > now;
      });

      return hasValidCookies;
    } catch (error) {
      console.error(`❌ Error validating storage state: ${error}`);
      return false;
    }
  }

  /**
   * Performs login and saves storage state
   */
  static async performLogin(
    user: UserCredentials,
    config: FullConfig,
    tenantName?: string,
  ): Promise<void> {
    const releaseLock = await this.acquireLock(user.envKey);

    try {
      // Double-check if another process already created it
      if (this.isStorageStateValid(user.storageStatePath)) {
        await log("info", `✅ Storage state already exists for ${user.envKey}`);
        return;
      }

      await log("info", `🔐 Performing login for ${user.envKey}...`);

      const browser = await chromium.launch(config.projects[0].use);
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        // Navigate to application
        await page.goto(envConfig.baseUrl, {
          waitUntil: "networkidle",
          timeout: 120_000,
        });

        // Click Active Directory
        await page.getByRole("button", { name: "Active Directory" }).click();

        // Fill credentials
        const userAccountField = page.getByRole("textbox", {
          name: "User Account",
        });
        await userAccountField.waitFor({ state: "visible", timeout: 30000 });
        await page.waitForLoadState("networkidle");

        await userAccountField.fill(user.username);
        await page
          .getByRole("textbox", { name: "Password" })
          .fill(user.password);

        await page.waitForLoadState("networkidle");

        await page.locator("#submitButton").evaluate((el) => {
          return new Promise((resolve) => {
            // Small delay to ensure handlers are attached
            setTimeout(resolve, 100);
          });
        });

        // Click submit and wait for navigation
        await Promise.all([
          page.waitForURL(/.*/, { waitUntil: "networkidle", timeout: 30_000 }),
          page.locator("#submitButton").click(),
        ]);

        // Wait for tenant selection
        await page
          .getByRole("heading", { name: "Choose Account" })
          .waitFor({ state: "visible", timeout: 30000 });

        // Select tenant if specified, otherwise use first available
        if (tenantName) {
          await page
            .locator(".divWrap")
            .filter({ hasText: tenantName })
            .getByRole("button", { name: "Choose" })
            .click();
        } else {
          await page.getByRole("button", { name: "Choose" }).first().click();
        }

        // Wait for app to load
        await page.waitForLoadState("networkidle");

        //Checking the Welcome message on landing page after successful login
        await expect(page.getByText("Welcome to CTMS Portal")).toBeVisible();

        // Save storage state
        await context.storageState({ path: user.storageStatePath });
        await log("info", `✅ Storage state saved for ${user.envKey}`);
      } finally {
        await context.close();
        await browser.close();
      }
    } finally {
      releaseLock();
    }
  }

  /**
   * Gets or creates storage state for a user
   */
  static async getOrCreateStorageState(
    user: UserCredentials,
    config: FullConfig,
    tenantName?: string,
  ): Promise<string> {
    this.ensureStorageStateDir();

    // Check if valid storage state exists
    if (this.isStorageStateValid(user.storageStatePath)) {
      await log("info", `✅ Using cached auth for ${user.envKey}`);
      return user.storageStatePath;
    }

    // Perform login with lock
    await this.performLogin(user, config, tenantName);
    return user.storageStatePath;
  }

  /**
   * Clears all storage states (useful for cleanup)
   */
  static clearAllStorageStates(): void {
    const storageDir = path.join(__dirname, "storageStates");
    if (fs.existsSync(storageDir)) {
      const files = fs.readdirSync(storageDir);
      files.forEach((file) => {
        if (file.endsWith(".json")) {
          fs.unlinkSync(path.join(storageDir, file));
        }
      });
      console.log("🧹 Cleared all storage states");
    }
  }
}
