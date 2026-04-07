import { Page, Locator } from "@playwright/test";
import { BasePage } from "@core/BasePage";

/**
 * ConsolePage
 *
 * Navigation path: click Console anchor
 *
 * OWNS:
 * - _clickConsole()
 * - Console landing page locators
 * - Console landing page readiness
 */
export class ConsolePage extends BasePage {
  protected readonly pageName = "ConsolePage";

  // ── Locators ───────────────────────────────────────────────────────────────
  // Console anchor confirmed from DOM:
  // ul.nav.navbar-nav.pull-right > li#consoleTab > a[routerlink="/console/programList"]
  private readonly consoleAnchor: Locator;

  constructor(page: Page) {
    super(page);

    this.consoleAnchor = page
      .locator("ul.nav.navbar-nav.pull-right li#consoleTab")
      .locator(
        'a[routerlink="/console/programList"], a[href="/console/programList"]',
      )
      .first();
  }

  // ── Readiness ──────────────────────────────────────────────────────────────
  // Console landing is ready when URL is on /console path
  protected async waitForPageReady(): Promise<void> {
    await this.page.waitForURL((url) => url.pathname.startsWith("/console"), {
      timeout: this.timeouts.navigation,
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  async goto(): Promise<void> {
    if (this.isNavigated) return;
    await this.waitForOverlayToClear();
    await this._clickConsole();
    await this.completeNavigation();
  }

  // ── Private navigation step ────────────────────────────────────────────────

  private async _clickConsole(): Promise<void> {
    await this.consoleAnchor.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });
    await this.consoleAnchor.click();
  }
}
