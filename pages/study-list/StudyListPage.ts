import { Page, Locator } from "@playwright/test";
import { BasePage } from "@core/BasePage";

/**
 * StudyListPage
 *
 * Navigation path:
 * hover Console → hover Study Management → click Study Management (studyList)
 *
 * OWNS:
 * - _hoverConsole()
 * - _hoverStudyManagement()
 * - _clickStudyList()
 * - Study List locators
 * - Study List readiness
 * - All Study List actions
 *
 * DOM CONFIRMED (CTMS-AUTO-CTX-v1):
 * ul.Console_Buttons_List
 *   li.dropdown_item-3 (no routerlink) → Study Management flyout parent
 *     ul.open-right
 *       li[routerlink="/console/studyList"] ← target (routerlink on li NOT a)
 *
 * Angular *ngIf pattern — JS evaluate required (CTMS-AUTO-CTX-v1)
 */
export class StudyListPage extends BasePage {
  protected readonly pageName = "StudyListPage";

  // ── Locators ───────────────────────────────────────────────────────────────
  private readonly studyListBreadcrumb: Locator;
  private readonly actionsPanel: Locator;

  // Visible after New Study / Configure Study
  // Confirmed from DOM: <span id="StudyConfigurationSummary">
  readonly configSummaryBreadcrumb: Locator;

  constructor(page: Page) {
    super(page);

    this.studyListBreadcrumb = page
      .locator("app-breadcrumbs ol.breadcrumb li")
      .first();

    this.actionsPanel = page
      .locator("app-sidebar, aside")
      .filter({ hasText: "Actions" })
      .first();

    this.configSummaryBreadcrumb = page.locator(
      "span#StudyConfigurationSummary",
    );
  }

  // ── Readiness ──────────────────────────────────────────────────────────────
  // Page is ready when BOTH breadcrumb AND Actions panel are visible
  protected async waitForPageReady(): Promise<void> {
    await this.studyListBreadcrumb.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });
    await this.actionsPanel.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  async goto(): Promise<void> {
    if (this.isNavigated) return;
    await this.waitForOverlayToClear();
    await this._hoverConsole();
    await this._hoverStudyManagement();
    await this._clickStudyList();
    await this.completeNavigation();
  }

  // ── Private navigation steps ───────────────────────────────────────────────

  /**
   * Move mouse to consoleTab — triggers Angular *ngIf to render
   * ul.Console_Buttons_List into the DOM.
   */
  private async _hoverConsole(): Promise<void> {
    const consoleTab = this.page.locator(
      "ul.nav.navbar-nav.pull-right li#consoleTab",
    );
    await consoleTab.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });
    const box = await consoleTab.boundingBox();
    if (!box)
      throw new Error("❌ [StudyListPage] consoleTab bounding box not found");

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Wait for dropdown to attach (*ngIf rendered)
    await this.page.waitForSelector("ul.Console_Buttons_List", {
      state: "attached",
      timeout: 5_000,
    });
  }

  /**
   * Force Console dropdown + Study Management flyout visible.
   * Does NOT click — exposes flyout for _clickStudyList().
   */
  private async _hoverStudyManagement(): Promise<void> {
    await this.page.evaluate(() => {
      // Force main dropdown visible
      const dd = document.querySelector(
        "ul.Console_Buttons_List",
      ) as HTMLElement;
      if (!dd) return;
      dd.style.cssText +=
        ";display:block!important;visibility:visible!important;opacity:1!important;";

      // Study Management = li.dropdown_item-3 with NO routerlink
      const sm = Array.from(
        dd.querySelectorAll(":scope > li.dropdown_item-3"),
      ).find((el) => !el.hasAttribute("routerlink")) as HTMLElement;
      if (!sm) return;
      sm.style.cssText +=
        ";display:block!important;visibility:visible!important;";

      // Force flyout + all children visible
      const flyout = sm.querySelector("ul.open-right") as HTMLElement;
      if (!flyout) return;
      flyout.style.cssText +=
        ";display:block!important;visibility:visible!important;opacity:1!important;";
      flyout.querySelectorAll("li, a").forEach((el) => {
        (el as HTMLElement).style.cssText +=
          ";display:block!important;visibility:visible!important;opacity:1!important;";
      });
    });
  }

  /**
   * Click Study List flyout item via JS evaluate.
   * routerlink="/console/studyList" confirmed on <li> not <a>.
   */
  private async _clickStudyList(): Promise<void> {
    const clicked = await this.page.evaluate(() => {
      const target = document.querySelector(
        'ul.Console_Buttons_List > li.dropdown_item-3:not([routerlink]) ul.open-right li[routerlink="/console/studyList"]',
      ) as HTMLElement;
      if (!target) return false;
      target.click();
      return true;
    });

    if (!clicked)
      throw new Error(
        "❌ [StudyListPage] Study List item not found in Study Management flyout",
      );
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  // All Study List left panel actions owned here.
  // button.filter pattern — avoids strict mode violation from inner <i title> icon
  // Confirmed pattern from CTMS-AUTO-CTX-v1

  async openNewStudy(): Promise<void> {
    await this.actionsPanel
      .locator("button")
      .filter({ has: this.page.locator('[title="New Study"]') })
      .click();
  }

  async configureSelectedStudy(): Promise<void> {
    await this.actionsPanel
      .locator("button")
      .filter({ has: this.page.locator('[title="Configure Study"]') })
      .click();
  }

  async completeSelectedStudy(): Promise<void> {
    await this.actionsPanel
      .locator("button")
      .filter({ has: this.page.locator('[title="Complete Study"]') })
      .click();
  }

  async deleteSelectedStudy(): Promise<void> {
    await this.actionsPanel
      .locator("button")
      .filter({ has: this.page.locator('[title="Delete Study"]') })
      .click();
  }

  // ── Study List grid interactions ───────────────────────────────────────────

  async searchStudy(studyId: string): Promise<void> {
    await this.page.getByPlaceholder("Search...").fill(studyId);
  }

  async selectStudyRowByStudyNo(studyNo: string): Promise<void> {
    await this.page
      .locator("tbody tr", { hasText: studyNo })
      .locator("input[type='checkbox']")
      .first()
      .check();
  }

  // ── Assertions ─────────────────────────────────────────────────────────────

  async isConfigSummaryBreadcrumbVisible(): Promise<boolean> {
    return await this.configSummaryBreadcrumb.isVisible();
  }
}
