import { Page, Locator } from "@playwright/test";
import { NavigationBar } from "@pages/components/NavigationBar";
import { SubNavigation } from "@pages/components/SubNavigation";
import { StudyHeader } from "@pages/components/StudyHeader";
import { StudyManagementSubMenu } from "@pages/components/StudyManagementSubMenu";
import { StudyManagementActions } from "@pages/console/study-management/StudyManagementActions";

/**
 * StudyManagementPage
 *
 * Page Object for:
 * Console → Study Management → Study List
 *
 * RESPONSIBILITIES (LOCKED):
 * - Orchestrate navigation using full hierarchy
 * - Own page-level readiness guarantees
 * - Delegate LEFT Actions to StudyManagementActions
 * - NEVER skip submenu layers
 */
export class StudyManagementPage {
  private readonly page: Page;
  private navigated = false;

  // Navigation layers
  readonly navigation: NavigationBar;
  readonly subNavigation: SubNavigation;
  readonly studyMgmtSubmenu: StudyManagementSubMenu;

  // Page components
  readonly actions: StudyManagementActions;
  readonly studyHeader: StudyHeader;

  // Breadcrumbs
  readonly studyListBreadcrumb: Locator;
  readonly breadcrumb: Locator;

  constructor(page: Page) {
    this.page = page;

    // ✅ Full navigation hierarchy
    this.navigation = new NavigationBar(page);
    this.subNavigation = new SubNavigation(this.navigation);
    this.studyMgmtSubmenu = new StudyManagementSubMenu(this.subNavigation);

    // ✅ Page-scoped components
    this.actions = new StudyManagementActions(page);
    this.studyHeader = new StudyHeader(page);

    // ✅ Study List page breadcrumb — first <li> in ol.breadcrumb inside app-breadcrumbs
    this.studyListBreadcrumb = page
      .locator("app-breadcrumbs ol.breadcrumb li")
      .first();

    // ✅ Study Configuration Summary breadcrumb — confirmed from DOM:
    // <span id="StudyConfigurationSummary">Study Configuration Summary</span>
    this.breadcrumb = page.locator("span#StudyConfigurationSummary");
  }

  /**
   * Navigate to:
   * Console → Study Management → Study List
   *
   * NAVIGATION SEQUENCE (2 steps, NEVER skip):
   * 1. hoverConsole()       → hover Console tab → opens dropdown
   * 2. openStudyList()      → hover Study Management → click Study List flyout
   *
   * DESIGN CONTRACT:
   * - Safe to call multiple times (navigated guard)
   * - Guarantees page is READY for actions
   * - Owns readiness (tests do NOT wait)
   */
  async gotoStudyList(): Promise<void> {
    if (this.navigated) return;

    // ✅ Wait for any overlay to fully clear before hover
    // Tenant chooser dismissal may still be animating
    await this.page
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

    // Navigate to Study List — JS forces dropdown/flyout visible, no hover needed
    await this.studyMgmtSubmenu.openStudyList();

    // ✅ Readiness: Study List breadcrumb must be visible
    await this.studyListBreadcrumb.waitFor({
      state: "visible",
      timeout: 15_000,
    });

    // ✅ Readiness: Actions panel must be visible
    await this.page
      .locator("app-sidebar, aside, div")
      .filter({ hasText: "Actions" })
      .first()
      .waitFor({ state: "visible" });

    this.navigated = true;
  }

  /**
   * Validate Study Configuration Summary breadcrumb visibility
   * Used for:
   * - TC001 (New Study)
   * - TC002 (Configure Study)
   */
  async isBreadcrumbVisible(): Promise<boolean> {
    return await this.breadcrumb.first().isVisible();
  }

  /**
   * Search for a study in Study List grid
   */
  async searchStudy(studyId: string): Promise<void> {
    await this.page.getByPlaceholder("Search...").fill(studyId);
  }

  /**
   * Select checkbox of the row matching exact Study No
   */
  async selectStudyRowByStudyNo(studyNo: string): Promise<void> {
    const row = this.page.locator("tbody tr", { hasText: studyNo });
    await row.getByRole("checkbox", { name: "Select Row" }).check();
  }

  /**
   * Get Study Number from Study Header
   */
  async getStudyNumber(): Promise<string> {
    return await this.studyHeader.getStudyNumber();
  }
}
