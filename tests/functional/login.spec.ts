import { test, expect } from "@playwright/test";
import { log } from "../helpers/logger";


test("Should login successfully", async ({ page }) => {
  await page.goto("https://ctms-val.siteromentor.com/");

  //Custom log entry for checking
  await log("info", 'Launching VAL environment');
  
  await page.getByRole("button", { name: "Active Directory" }).click();
  await expect(
    page.getByRole("img", { name: "Sitero Single SignOn" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "User Account" })
    .fill("Validation13@sitero.com");

  await page.getByRole("textbox", { name: "Password" }).fill("Welcome@13");
  console.log(await page.locator("#submitButton").isVisible());
  console.log(await page.locator("#submitButton").isEnabled());
  console.log(await page.locator("#submitButton").isDisabled());
  await page.locator('#submissionArea #submitButton').click({ trial: true });
  await page.locator("#submitButton").click();

  //await page.getByRole("button", { name: "Sign in" }).press("Enter")
  await expect(
    page.getByRole("heading", { name: "Choose Account" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Choose" }).first().click();
});
