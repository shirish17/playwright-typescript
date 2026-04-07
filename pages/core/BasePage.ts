import { Page } from "@playwright/test";
import { EnvLoader } from "@config/envLoader";

/**
 * BasePage — Universal framework contract.
 *
 * LOCATION: pages/core/BasePage.ts
 * IMPORT:   import { BasePage } from "@core/BasePage"
 *
 * OWNS:
 * - Navigated guard (idempotent goto)
 * - Overlay wait (single source of truth)
 * - Environment-driven timeouts
 * - Page readiness contract (TypeScript enforced)
 * - Navigation lifecycle logging
 *
 * DOES NOT OWN:
 * - Navigation logic — each page owns its full path
 * - Locators — each page owns its own
 * - Actions — each page owns its own
 * - Auth / tenant — AuthManager
 * - Test data — fixtures
 *
 * RULE FOR ALL PAGES:
 * Every page MUST extend BasePage and implement:
 *   - pageName: string
 *   - waitForPageReady(): Promise<void>
 *   - goto(): Promise<void>
 *
 * RULE FOR goto():
 *   - Must start with: if (this.isNavigated) return;
 *   - Must end with:   await this.completeNavigation();
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  // ── Navigated guard ───────────────────────────────────────────────────────
  private _navigated = false;

  protected get isNavigated(): boolean {
    return this._navigated;
  }

  protected markNavigated(): void {
    this._navigated = true;
  }

  /**
   * Reset navigated guard.
   * Use ONLY in tests that explicitly need to re-navigate the same page.
   * Never call from within page objects.
   */
  resetNavigation(): void {
    this._navigated = false;
  }

  // ── Environment-driven timeouts ───────────────────────────────────────────
  // All page waits MUST use these — never hardcode timeout values

  protected get timeouts() {
    return EnvLoader.getTimeouts();
  }

  // ── Overlay wait — single source of truth ─────────────────────────────────
  // Confirmed Angular overlay pattern — CTMS-AUTO-CTX-v1
  // Angular hides via CSS transitions — does NOT detach from DOM
  // Must use computed style polling — NOT waitFor({ state: "detached" })

  protected async waitForOverlayToClear(): Promise<void> {
    await this.page
      .waitForFunction(
        () => {
          const overlay = document.querySelector(".overlay") as HTMLElement;
          if (!overlay) return true;
          const style = window.getComputedStyle(overlay);
          const rect = overlay.getBoundingClientRect();
          return (
            style.display === "none" ||
            style.visibility === "hidden" ||
            rect.height === 0
          );
        },
        { timeout: 10_000 },
      )
      .catch(() => {});
  }

  // ── Navigation lifecycle ───────────────────────────────────────────────────

  /**
   * Call at the END of every goto() after navigation completes.
   * Runs waitForPageReady() → markNavigated() → logs.
   */
  protected async completeNavigation(): Promise<void> {
    console.log(
      `⏳ [${this.pageName}] waiting for page ready — URL: ${this.page.url()}`,
    );
    await this.waitForPageReady();
    this.markNavigated();
    console.log(`✅ [${this.pageName}] ready — URL: ${this.page.url()}`);
  }

  // ── Enforced contracts ────────────────────────────────────────────────────
  // TypeScript compile error if not implemented in subclass

  /** Page identifier for logging. Set to the class name. */
  protected abstract readonly pageName: string;

  /**
   * Page-specific readiness signal.
   * Wait for the element that confirms the page is fully loaded.
   * Called automatically by completeNavigation() — never call directly.
   */
  protected abstract waitForPageReady(): Promise<void>;

  /**
   * Navigate to this page.
   * Must start with: if (this.isNavigated) return;
   * Must end with:   await this.completeNavigation();
   */
  abstract goto(): Promise<void>;
}
