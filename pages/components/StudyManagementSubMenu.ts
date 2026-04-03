import { Page } from "@playwright/test";
import { SubNavigation } from "@pages/components/SubNavigation";

/**
 * Fly-out menu: Console → Study Management
 *
 * DOM STRUCTURE (confirmed from live DOM dump):
 * ul.Console_Buttons_List  ← rendered by Angular *ngIf on consoleTab hover
 *   li.dropdown_item-3 (no routerlink) → Study Management
 *     a → "Study Management"
 *     ul.open-right
 *       li[routerlink="/console/studyList"].dropdown_item-1
 *         a → "Study Management"
 *       li[routerlink="/console/studyDetailsList"].dropdown_item-2
 *         a → "Study Details List"
 *
 * STRATEGY:
 * 1. Move mouse to consoleTab center — triggers Angular *ngIf → dropdown renders
 * 2. Immediately JS-force dropdown + flyout visible while mouse still on tab
 * 3. Click target li by routerlink
 */
export class StudyManagementSubMenu {
  private readonly page: Page;

  constructor(subNavigation: SubNavigation) {
    this.page = (subNavigation as any).navBar.page;
  }

  async openStudyList(): Promise<void> {
    await this._navigate("/console/studyList");
  }

  async openStudyDetailsList(): Promise<void> {
    await this._navigate("/console/studyDetailsList");
  }

  private async _navigate(routerlink: string): Promise<void> {
    const page = this.page;

    // ─── Step 1: Get consoleTab coordinates ───────────────────────────────────
    const consoleTab = page.locator(
      "ul.nav.navbar-nav.pull-right li#consoleTab",
    );
    await consoleTab.waitFor({ state: "visible", timeout: 10_000 });
    const tabBox = await consoleTab.boundingBox();
    if (!tabBox) throw new Error("❌ consoleTab bounding box not found");

    // ─── Step 2: Move mouse to consoleTab — Angular renders dropdown ──────────
    await page.mouse.move(
      tabBox.x + tabBox.width / 2,
      tabBox.y + tabBox.height / 2,
    );

    // ─── Step 3: Wait for dropdown to appear in DOM ────────────────────────────
    await page.waitForSelector("ul.Console_Buttons_List", {
      state: "attached",
      timeout: 5_000,
    });

    // ─── Step 4: Immediately JS-force everything visible ──────────────────────
    // Mouse is still on consoleTab — dropdown is in DOM
    // Force in one synchronous call — no awaits inside
    await page.evaluate(() => {
      const dd = document.querySelector(
        "ul.Console_Buttons_List",
      ) as HTMLElement;
      if (!dd) return;
      dd.style.cssText +=
        ";display:block!important;visibility:visible!important;opacity:1!important;";

      // li.dropdown_item-3 with no routerlink = Study Management
      const sm = Array.from(
        dd.querySelectorAll(":scope > li.dropdown_item-3"),
      ).find((el) => !el.hasAttribute("routerlink")) as HTMLElement;
      if (!sm) return;
      sm.style.cssText +=
        ";display:block!important;visibility:visible!important;";

      const flyout = sm.querySelector("ul.open-right") as HTMLElement;
      if (!flyout) return;
      flyout.style.cssText +=
        ";display:block!important;visibility:visible!important;opacity:1!important;";

      // Force all flyout children
      flyout.querySelectorAll("li, a").forEach((el) => {
        (el as HTMLElement).style.cssText +=
          ";display:block!important;visibility:visible!important;opacity:1!important;";
      });
    });

    // ─── Step 5: Click target directly via JS — bypasses visibility check ──────
    // Angular overrides inline styles — Playwright waitFor visible keeps failing.
    // JS click fires directly on the DOM element regardless of CSS visibility.
    const clicked = await page.evaluate((rl: string) => {
      const target = document.querySelector(
        `ul.Console_Buttons_List > li.dropdown_item-3:not([routerlink]) ul.open-right li[routerlink="${rl}"]`,
      ) as HTMLElement;
      if (!target) return false;
      target.click();
      return true;
    }, routerlink);

    if (!clicked)
      throw new Error(`❌ Could not find flyout item for ${routerlink}`);
  }
}
