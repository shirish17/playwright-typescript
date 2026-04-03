import { Page, Locator } from "@playwright/test";

/**
 * Top-level navigation bar component
 * Clean, stable, and scalable locator strategy
 */
export class NavigationBar {
  readonly page: Page;

  private readonly navRoot: Locator;

  private readonly configurationMenu: Locator;
  private readonly consoleMenu: Locator;
  private readonly reportsMenu: Locator;
  private readonly ctmsMenu: Locator;
  private readonly paymentsMenu: Locator;
  private readonly inventoryMenu: Locator;
  private readonly notificationBell: Locator;
  private readonly userProfile: Locator;

  constructor(page: Page) {
    this.page = page;

    // ✅ More precise scope (recommended)
    this.navRoot = page.locator("ul.nav.navbar-nav.pull-right");

    this.configurationMenu = this.navRoot.locator(
      'a[routerlink="/configuration"], a[href="/configuration"]',
    );

    this.consoleMenu = this.navRoot.locator(
      'a[routerlink="/console/programList"], a[href="/console/programList"]',
    );

    this.reportsMenu = this.navRoot.locator(
      'a[routerlink="/reports"], a[href="/reports"]',
    );

    this.ctmsMenu = this.navRoot.locator(
      'a[routerlink="/ctms"], a[href="/ctms"]',
    );

    this.paymentsMenu = this.navRoot.locator(
      'a[routerlink="/payments"], a[href="/payments"]',
    );

    this.inventoryMenu = this.navRoot.locator(
      'a[routerlink="/inventory"], a[href="/inventory"]',
    );

    this.notificationBell = page.locator('[class*="notification"]').first();
    this.userProfile = page.locator('[class*="user-profile"]').first();
  }

  async goToConfiguration() {
    await this.configurationMenu.first().click();
  }

  async goToConsole() {
    await this.consoleMenu.first().click();
  }

  async goToReports() {
    await this.reportsMenu.first().click();
  }

  async goToCTMS() {
    await this.ctmsMenu.first().click();
  }

  async goToPayments() {
    await this.paymentsMenu.first().click();
  }

  async goToInventory() {
    await this.inventoryMenu.first().click();
  }

  async getNotificationCount(): Promise<string> {
    return (await this.notificationBell.textContent()) || "0";
  }

  async openNotifications() {
    await this.notificationBell.click();
  }

  async openUserProfile() {
    await this.userProfile.click();
  }
}
