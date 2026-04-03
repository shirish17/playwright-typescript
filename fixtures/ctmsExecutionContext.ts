import { test as base, Page } from "@playwright/test";
import { DataLoader, TestScenarioRow } from "@data/dataLoader";
import { EnvLoader } from "@config/envLoader";
import { AuthManager } from "@auth/authManager";

export type TestData = {
  raw: TestScenarioRow;
  resolved: any;
  users: string[];
};

type CTMSFixtures = {
  testData: TestData;
  authPage: (username: string) => Promise<Page>;
};

export const test = base.extend<CTMSFixtures>({
  // -----------------------------
  // DATA FIXTURE (DATA ONLY)
  // -----------------------------
  testData: async ({}, use, testInfo) => {
    const testId = testInfo.title.match(/^(TC\d+)/)?.[1];
    if (!testId) {
      throw new Error(`❌ Test title must start with testId`);
    }

    const scenarioFile =
      testInfo.annotations.find((a) => a.type === "scenario")?.description ??
      "study-management.csv";

    const rows = DataLoader.loadScenario(scenarioFile);
    const row = rows.find((r) => r.testId === testId);

    if (!row) {
      throw new Error(`❌ No test data found for ${testId}`);
    }

    const resolved = DataLoader.resolveTestData(row);
    const users = row.users
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    await use({ raw: row, resolved, users });
  },

  // -----------------------------
  // AUTH FIXTURE (CONSUMER ONLY)
  // -----------------------------
  authPage: async ({ browser }, use) => {
    await use(async (username: string) => {
      const user = EnvLoader.getUserByUsername(username);

      const storageStatePath = await AuthManager.getOrCreateStorageState(user);

      const context = await browser.newContext({
        storageState: storageStatePath,
        baseURL: EnvLoader.getBaseUrl(),
        ignoreHTTPSErrors: true,
      });

      const page = await context.newPage();

      // ✅ networkidle required — SPA hydrates async after session restore
      // domcontentloaded is too early, Angular nav is not rendered yet
      await page.goto("/", { waitUntil: "networkidle", timeout: 90_000 }); // 90 seconds  because the page redirction takes time sometimes

      // ✅ Tenant modal must be resolved HERE — before returning page to test
      // Stored session reuse skips getOrCreateStorageState login flow entirely
      // so this is the only guaranteed place to handle the modal on session reuse
      await AuthManager.resolveTenantIfRequired(page, user.tenant);

      return page;
    });
  },
});

export { expect } from "@playwright/test";
