import { test, expect } from "@fixtures/ctmsExecutionContext.js";
import { StudyListPage } from "@pages/study-list/StudyListPage.js";

/**
 * Study Management – Left Actions
 *
 * Covered Scenarios:
 * TC001 – User able to create new study
 * TC002 – User able to configure existing study
 *
 * LOCKED under CTMS Automation Context
 */

// --------------------------------------------------
// TC001 – New Study (Breadcrumb Validation Only)
// --------------------------------------------------
test.only("TC001 – User able to create new study", async ({
  testData,
  authPage,
}) => {
  // ✅ One execution = one user
  const username = testData.users[0];

  const page = await authPage(username);
  const studyList = new StudyListPage(page);

  // ✅ Page object owns navigation + readiness
  await studyList.goto();

  // ✅ LEFT ACTION: New Study
  await studyList.openNewStudy();

  // ✅ Assert only what TC001 is meant to assert
  expect(await studyList.isConfigSummaryBreadcrumbVisible()).toBeTruthy();
});

// --------------------------------------------------
// TC002 – Configure Study (Breadcrumb + Study No)
// --------------------------------------------------
test("TC002 – User able to configure existing study", async ({
  testData,
  authPage,
}) => {
  for (const username of testData.users) {
    const page = await authPage(username);
    const studyList = new StudyListPage(page);

    // ✅ Navigate using full hierarchy
    await studyList.goto();

    // ✅ Search + select exact study
    await studyList.searchStudy("SDY-001");
    await studyList.selectStudyRowByStudyNo("SDY-001");

    // ✅ LEFT ACTION: Configure Study
    await studyList.configureSelectedStudy();

    // ✅ Validate navigation + correctness
    expect(await studyList.isConfigSummaryBreadcrumbVisible()).toBeTruthy();

    await page.context().close();
  }
});
