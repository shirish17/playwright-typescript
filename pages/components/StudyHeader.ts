import { Page, Locator } from "@playwright/test";

/**
 * Study header component showing study number, status, sites, subjects
 * Appears on study detail pages
 */
export class StudyHeader {
  readonly page: Page;

  readonly studyNumber: Locator;
  readonly status: Locator;
  readonly actualSites: Locator;
  readonly actualSubjects: Locator;
  readonly deployButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.studyNumber = page
      .locator("text=/Study No\\.:\\s*/")
      .locator("..")
      .locator("text=/N\\/A|\\w+/");
    this.status = page
      .locator("text=/Status:/")
      .locator("..")
      .locator('[class*="status"]');
    this.actualSites = page
      .locator("text=/Actual Sites:/")
      .locator("..")
      .locator("text=/N\\/A|\\d+/");
    this.actualSubjects = page
      .locator("text=/Actual Subjects:/")
      .locator("..")
      .locator("text=/N\\/A|\\d+/");
    this.deployButton = page.getByRole("button", { name: "Deploy" });
  }

  async getStudyNumber(): Promise<string> {
    return (await this.studyNumber.textContent()) || "N/A";
  }

  async getStatus(): Promise<string> {
    return (await this.status.textContent()) || "";
  }

  async getActualSites(): Promise<string> {
    return (await this.actualSites.textContent()) || "N/A";
  }

  async getActualSubjects(): Promise<string> {
    return (await this.actualSubjects.textContent()) || "N/A";
  }

  async clickDeploy() {
    await this.deployButton.click();
  }

  async isDeployEnabled(): Promise<boolean> {
    return await this.deployButton.isEnabled();
  }
}
