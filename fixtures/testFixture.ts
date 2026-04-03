// ===============================
// Imports (LOCKED – ALWAYS AT TOP)
// ===============================

import { test as base } from "@playwright/test";
import { DataLoader, TestScenarioRow } from "@data/dataLoader";

// ===============================
// Types
// ===============================

export type TestData = {
  /**
   * Raw CSV row (one execution instance)
   */
  raw: TestScenarioRow;

  /**
   * CSV row with all *Ref fields resolved
   */
  resolved: any;

  /**
   * Ordered list of usernames for this execution
   */
  users: string[];
};

export type TestFixtures = {
  testData: TestData;
};

// ===============================
// Test Fixture (DATA ONLY)
// ===============================

export const test = base.extend<TestFixtures>({
  testData: async ({}, use, testInfo) => {
    // --------------------------------
    // Resolve testId from test title
    // --------------------------------
    const testId = testInfo.title.match(/^(TC\d+)/)?.[1];

    if (!testId) {
      throw new Error(
        `❌ Test title must start with testId (e.g. "TC001 – Test name")`,
      );
    }

    // --------------------------------
    // Resolve scenario file
    // --------------------------------
    const scenarioFile =
      testInfo.annotations.find((a) => a.type === "scenario")?.description ??
      "study-creation.csv";

    // --------------------------------
    // Load scenario and locate row
    // --------------------------------
    const rows = DataLoader.loadScenario(scenarioFile);
    const row = rows.find((r) => r.testId === testId);

    if (!row) {
      throw new Error(`❌ No test data found for ${testId} in ${scenarioFile}`);
    }

    // --------------------------------
    // Resolve reference data (*Ref)
    // --------------------------------
    const resolved = DataLoader.resolveTestData(row);

    // --------------------------------
    // Extract ordered users
    // --------------------------------
    const users = row.users
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);

    if (users.length === 0) {
      throw new Error(`❌ No users defined for ${testId} in ${scenarioFile}`);
    }

    // --------------------------------
    // Expose test data
    // --------------------------------
    await use({
      raw: row,
      resolved,
      users,
    });
  },
});

// ===============================
// Re-export expect
// ===============================

export { expect } from "@playwright/test";
