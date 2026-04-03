import { Locator } from "@playwright/test";
import { NavigationBar } from "@pages/components/NavigationBar";

/**
 * Sub-navigation under Console menu.
 *
 * DOM STRUCTURE (confirmed):
 * ul.nav.navbar-nav.pull-right
 *   li#consoleTab.dropdown.dropdown-1.showTab
 *     a[routerlink="/console/programList"]
 *     ul.Console_Buttons_List               ← *ngIf, only in DOM when hovered
 *       li[routerlink="/console/programList"]
 *       li[routerlink="/console/testArticleList"]
 *       li.dropdown_item-3                  ← Study Management flyout parent
 *       li[routerlink="/console/documentManagement"]
 *       ...
 *
 * OWNERSHIP:
 * - hoverConsole() + direct level-1 clicks (Program List, Test Article etc.)
 * - FlyoutSubMenu classes own their own full navigation — do NOT call hoverConsole()
 *
 * RULES (LOCKED):
 * - hoverConsole() MUST be called before any direct level-1 click
 * - MUST NOT handle flyout parents — StudyManagementSubMenu owns that
 * - MUST NOT click Console anchor
 * - menuRoot only accessible after hoverConsole() renders ul.Console_Buttons_List
 */
export class SubNavigation {
  private readonly consoleTab: Locator;
  private readonly menuRoot: Locator;

  constructor(private readonly navBar: NavigationBar) {
    // ✅ li#consoleTab — stable id confirmed from DOM
    this.consoleTab = this.navBar["navRoot"].locator("li#consoleTab");

    // ✅ ul.Console_Buttons_List — actual menu root confirmed from DOM
    // Only exists in DOM after hoverConsole() triggers Angular *ngIf
    this.menuRoot = this.consoleTab.locator("ul.Console_Buttons_List");
  }

  /**
   * Hover li#consoleTab — triggers Angular *ngIf to render ul.Console_Buttons_List.
   * MUST be called before any direct level-1 click method below.
   * NOT required by FlyoutSubMenu classes — they handle their own navigation.
   */
  async hoverConsole(): Promise<void> {
    await this.consoleTab.hover();
  }

  // ---------- LEVEL 1 DIRECT CLICKS ----------
  // Each requires hoverConsole() to be called first.
  // Identified by routerlink attribute — no text locators.

  async openProgramList(): Promise<void> {
    await this.menuRoot
      .locator('li[routerlink="/console/programList"]')
      .click();
  }

  async openTestArticleList(): Promise<void> {
    await this.menuRoot
      .locator('li[routerlink="/console/testArticleList"]')
      .click();
  }

  async openDocumentManagement(): Promise<void> {
    await this.menuRoot
      .locator('li[routerlink="/console/documentManagement"]')
      .click();
  }

  async openWorkflowManagement(): Promise<void> {
    await this.menuRoot
      .locator('li[routerlink="/console/workflowStatus"]')
      .click();
  }

  async openAuditTrail(): Promise<void> {
    await this.menuRoot.locator('li[routerlink="/console/auditTrial"]').click();
  }

  async openAlertManagement(): Promise<void> {
    await this.menuRoot
      .locator('li[routerlink="/console/alertManagement"]')
      .click();
  }
}
