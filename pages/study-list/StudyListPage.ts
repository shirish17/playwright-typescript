import { Page, Locator, expect } from "@playwright/test";
import { BasePage } from "@core/BasePage.js";

/**
 * StudyListPage
 *
 * Navigation strategy (BUSINESS‑CORRECT):
 * hover Console → direct router click Study List
 *
 * RATIONALE:
 * - Console flyout UI is non‑deterministic and hover‑time based
 * - We validate navigation correctness, not hover choreography
 * - Router click is stable, deterministic, and CI‑safe
 *
 * DOM CONFIRMED (CTMS-AUTO-CTX-v1):
 * li[routerlink="/console/studyList"] ← reliable navigation anchor
 */
export class StudyListPage extends BasePage {
  protected readonly pageName = "StudyListPage";

  // ── Locators ───────────────────────────────────────────────────────────────
  private readonly studyListBreadcrumb: Locator;
  private readonly actionsPanel: Locator;

  readonly configSummaryBreadcrumb: Locator;

  constructor(page: Page) {
    super(page);

    this.studyListBreadcrumb = page
      .locator("app-breadcrumbs ol.breadcrumb li")
      .first();

    this.actionsPanel = page
      .locator("app-sidebar")
      .getByText("Actions", { exact: true })
      .locator("..");

    this.configSummaryBreadcrumb = page.locator(
      "span#StudyConfigurationSummary",
    );
  }

  // ── Readiness ──────────────────────────────────────────────────────────────
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

    // Console hover is required only to ensure menu DOM exists
    await this._hoverConsole();

    // ✅ BUSINESS‑CORRECT: router click (no hover dependency)
    await this._clickStudyList();

    await this.completeNavigation();

    // Ensure any residual overlay focus is cleared
    await this.page.mouse.move(0, 0);

    await this.waitForPageReady();
  }

  // ── Private navigation steps ───────────────────────────────────────────────

  /**
   * Hover Console to allow Angular to render console menu DOM
   */
  private async _hoverConsole(): Promise<void> {
    const consoleTab = this.page.locator(
      "ul.nav.navbar-nav.pull-right li#consoleTab",
    );

    await consoleTab.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });

    await consoleTab.hover();

    await this.page.waitForSelector("ul.Console_Buttons_List", {
      state: "attached",
      timeout: 5_000,
    });
  }

  /**
   * Deterministic navigation via routerlink.
   * No dependency on hover timing, flyout animation, or pointer geometry.
   */
  private async _clickStudyList(): Promise<void> {
    const clicked = await this.page.evaluate(() => {
      const el = document.querySelector(
        'li[routerlink="/console/studyList"]',
      ) as HTMLElement | null;

      if (!el) return false;
      el.click();
      return true;
    });

    if (!clicked) {
      throw new Error(
        "❌ [StudyListPage] routerlink=/console/studyList not found",
      );
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async openNewStudy(): Promise<void> {
    // ---- 1. Grid stabilization (CRITICAL) ----
    // Kendo grid must render at least one row before Actions become usable
    await this.page.locator("tbody.k-table-tbody tr").first().waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });

    // ---- 2. Locate New Study button structurally ----
    const newStudyBtn = this.page
      .locator("app-sidebar")
      .locator("button")
      .filter({
        has: this.page.locator("span", { hasText: "New Study" }),
      });

    // ---- 3. Ensure button is ready ----
    await newStudyBtn.waitFor({
      state: "visible",
      timeout: this.timeouts.navigation,
    });

    await expect(newStudyBtn).toBeEnabled({
      timeout: this.timeouts.navigation,
    });

    // ---- 4. Scroll inside sidebar (mandatory) ----
    await newStudyBtn.scrollIntoViewIfNeeded();

    // ---- 5. Click ----
    await newStudyBtn.click();
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
