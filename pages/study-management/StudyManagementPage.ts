import { Page, Locator } from "@playwright/test";
import { BasePage } from "@core/BasePage";

/**
 * StudyManagementPage
 *
 * Navigation path: hover Console → click Study Management
 *
 * OWNS:
 * - _hoverConsole()
 * - _clickStudyManagement()
 * - Study Management landing locators
 * - Study Management landing readiness
 *
 * DOM CONFIRMED (CTMS-AUTO-CTX-v1):
 * ul.Console_Buttons_List (*ngIf — only in DOM when hovered)
 *   li.dropdown_item-3 (NO routerlink) ← Study Management flyout parent
 *     a → "Study Management"
 *     ul.open-right ← flyout
 *
 * Angular *ngIf pattern — JS evaluate required (CTMS-AUTO-CTX-v1)
 */
export class StudyManagementPage extends BasePage {
  protected readonly pageName = "StudyManagementPage";

  // ── Locators ───────────────────────────────────────────────────────────────
  // First breadcrumb li confirms Study Management landing loaded
  private readonly breadcrumb: Locator;

  constructor(page: Page) {
    super(page);

    this.breadcrumb = page.locator("app-breadcrumbs ol.breadcrumb li").first();
  }

  // ── Readiness ──────────────────────────────────────────────────────────────
  protected async waitForPageReady(): Promise<void> {
    await this.breadcrumb.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  async goto(): Promise<void> {
    if (this.isNavigated) return;
    await this.waitForOverlayToClear();
    await this._hoverConsole();
    await this._clickStudyManagement();
    await this.completeNavigation();
  }

  // ── Private navigation steps ───────────────────────────────────────────────

  /**
   * Move mouse to consoleTab — triggers Angular *ngIf to render
   * ul.Console_Buttons_List into the DOM.
   */
  protected async _hoverConsole(): Promise<void> {
    const consoleTab = this.page.locator(
      "ul.nav.navbar-nav.pull-right li#consoleTab",
    );
    await consoleTab.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });
    const box = await consoleTab.boundingBox();
    if (!box)
      throw new Error(
        "❌ [StudyManagementPage] consoleTab bounding box not found",
      );

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Wait for dropdown to attach to DOM (*ngIf rendered)
    await this.page.waitForSelector("ul.Console_Buttons_List", {
      state: "attached",
      timeout: 5_000,
    });
  }

  /**
   * Force Console dropdown visible + click Study Management flyout parent.
   * Study Management = li.dropdown_item-3 with NO routerlink — confirmed DOM.
   */
  protected async _clickStudyManagement(): Promise<void> {
    const clicked = await this.page.evaluate(() => {
      const dd = document.querySelector(
        "ul.Console_Buttons_List",
      ) as HTMLElement;
      if (!dd) return false;

      dd.style.cssText +=
        ";display:block!important;visibility:visible!important;opacity:1!important;";

      // Study Management = only li.dropdown_item-3 with NO routerlink
      const sm = Array.from(
        dd.querySelectorAll(":scope > li.dropdown_item-3"),
      ).find((el) => !el.hasAttribute("routerlink")) as HTMLElement;
      if (!sm) return false;

      sm.style.cssText +=
        ";display:block!important;visibility:visible!important;";
      sm.click();
      return true;
    });

    if (!clicked)
      throw new Error(
        "❌ [StudyManagementPage] Study Management item not found in Console dropdown",
      );
  }
}
