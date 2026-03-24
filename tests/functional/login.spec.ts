import { test, expect } from "@playwright/test";
import { log } from "../helpers/logger";

test("Should login successfully", async ({ page }) => {
  await page.goto("https://ctms-val.siteromentor.com/", {
    waitUntil: "networkidle",
    timeout: 120_000, //this is dynamic wait, since adfs call sometimes very slow
  });

  await log("info", "Launching VAL environment");

  // Wait for ADFS redirect and Active Directory button
  await page.getByRole("button", { name: "Active Directory" }).click();

  await log("info", "Clicked Active Directory button");

  // Wait for login form
  const userAccountField = page.getByRole("textbox", { name: "User Account" });
  await expect(userAccountField).toBeVisible({ timeout: 30_000 });

  // Fill credentials
  await userAccountField.fill("Validation13@sitero.com");
  await page.getByRole("textbox", { name: "Password" }).fill("Welcome@13");

  await log("info", "Filled login credentials");
  // Small delay to ensure sign in button clickable
  //await page.waitForTimeout(500);

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

  // Wait for tenant selection page
  await expect(
    page.getByRole("heading", { name: "Choose Account" }),
  ).toBeVisible({
    timeout: 30_000,
  });

  await log("info", "Tenant selection page loaded");

  // Select tenant by name
  const tenantName = "VAL51";
  await page
    .locator(".divWrap")
    .filter({ hasText: tenantName })
    .getByRole("button", { name: "Choose" })
    .click();

  await log("info", `Selected tenant: ${tenantName}`);

  // Wait for final page load
  await page.waitForLoadState("networkidle");

  await log("info", "Verifying successful login and landing page readiness");

  //Checking the Welcome message on landing page after successful login
  await expect(page.getByText("Welcome to CTMS Portal")).toBeVisible();

  await log(
    "info",
    "Login successful: welcome message is visible on CTMS landing page",
  );

  //Checking URL of landing page after successful login
  await expect(page).toHaveURL("https://ctms-val.siteromentor.com/ctms");

  await log("info", "Post-login redirection to CTMS landing page verified");
});
