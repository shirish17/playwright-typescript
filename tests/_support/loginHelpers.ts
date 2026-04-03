import { Page, expect } from "@playwright/test";
import { UserCredentials } from "../../config/users.config";
import { log } from "./logger";
import { envConfig } from "../../config/envLoader";

export async function selectTenantByName(
  page: Page,
  tenantName: string,
): Promise<void> {
  await page
    .locator(".divWrap")
    .filter({ hasText: tenantName })
    .getByRole("button", { name: "Choose" })
    .click();

  await log("info", `Selected tenant: ${tenantName}`);
}

export async function performManualLogin(
  page: Page,
  user: UserCredentials,
  tenantName?: string,
): Promise<void> {
  await page.goto(envConfig.baseUrl, {
    waitUntil: "networkidle",
    timeout: 120_000, //this is dynamic wait, since adfs call sometimes very slow
  });

  await log(
    "info",
    `Launching application in ${envConfig.env.toUpperCase()} environment`,
  );

  await page.getByRole("button", { name: "Active Directory" }).click();

  const userAccountField = page.getByRole("textbox", { name: "User Account" });
  await userAccountField.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForLoadState("networkidle");

  await userAccountField.fill(user.username);
  await page.getByRole("textbox", { name: "Password" }).fill(user.password);
  await page.waitForLoadState("networkidle");

  // Wait for any JavaScript to attach event handlers
  await page.locator("#submitButton").evaluate((el) => {
    return new Promise((resolve) => {
      // Small delay to ensure handlers are attached
      setTimeout(resolve, 100);
    });
  });

  // Click submit and wait for navigation
  await Promise.all([
    page.waitForURL(/.*/, { waitUntil: "networkidle", timeout: 30_000 }),
    page.locator("#submitButton").click(),
  ]);

  await log("info", "Clicked Sign In button");

  await page
    .getByRole("heading", { name: "Choose Account" })
    .waitFor({ state: "visible", timeout: 30000 });

  if (tenantName) {
    await selectTenantByName(page, tenantName);
  } else {
    await page.getByRole("button", { name: "Choose" }).first().click();
  }

  // Wait for final page load
  await page.waitForLoadState("networkidle");

  //Checking the Welcome message on landing page after successful login
  await expect(page.getByText("Welcome to CTMS Portal")).toBeVisible();
  //Checking URL of landing page after successful login
  await expect(page).toHaveURL(`${envConfig.baseUrl}/ctms`);
}
