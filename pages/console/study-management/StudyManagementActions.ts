import { Page, Locator } from "@playwright/test";

/**
 * Page-scoped LEFT Actions panel for Study Management.
 * LOCKED under CTMS Automation context.
 *
 * DOM STRUCTURE (confirmed):
 * app-sidebar / aside / div [hasText "Actions"]
 *   button → New Study (contains <i title="New Study"> icon inside)
 *   button → Configure Study
 *
 * LOCATOR STRATEGY:
 * - actionsPanel: scoped to sidebar container with "Actions" text
 * - actions: button only — icon <i> excluded via button scope
 *   [title="New Study"] matches BOTH button and icon — do NOT use title alone
 *   Use button[title="New Study"] to scope to button element only
 */
export class StudyManagementActions {
  private readonly actionsPanel: Locator;
  private readonly newStudyAction: Locator;
  private readonly configureStudyAction: Locator;

  constructor(page: Page) {
    // ✅ Parent scope: sidebar containing "Actions" header
    this.actionsPanel = page
      .locator("app-sidebar, aside, div")
      .filter({ hasText: "Actions" })
      .first();

    // ✅ button scoped — excludes <i title="New Study"> icon inside the button
    this.newStudyAction = this.actionsPanel.locator("button").filter({
      has: page.locator('[title="New Study"]'),
    });

    // ✅ button scoped — excludes <i title="Configure Study"> icon
    this.configureStudyAction = this.actionsPanel.locator("button").filter({
      has: page.locator('[title="Configure Study"]'),
    });
  }

  async openNewStudy(): Promise<void> {
    await this.newStudyAction.click();
  }

  async configureSelectedStudy(): Promise<void> {
    await this.configureStudyAction.click();
  }
}
