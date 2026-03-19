import { test, expect } from "@playwright/test";

test("Should login successfully", async ({ page }) => {
  await page.goto("https://ctms-val.siteromentor.com/");
  await page.getByRole("button", { name: "Active Directory" }).click();
  await expect(
    page.getByRole("img", { name: "Sitero Single SignOn" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "User Account" }).fill("");
  await page.getByRole("textbox", { name: "Password" }).fill("");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose Account" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Choose" }).first().click();
});
