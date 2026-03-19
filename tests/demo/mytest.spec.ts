import { test, expect, } from '@playwright/test'

test("should display homepage with title", async ({page}) => {
   //Fire application url
    await page.goto ("https://ctms-val.siteromentor.com/");
//  Assert if the title is correct
   await expect(page).toHaveTitle("Home Realm Discovery");
  
} )