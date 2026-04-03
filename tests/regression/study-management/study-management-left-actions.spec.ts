import { test, expect } from "@fixtures/ctmsExecutionContext";
import { StudyManagementPage } from "@pages/console/study-management/StudyManagementPage";

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
  const studyPage = new StudyManagementPage(page);

  // ✅ Page object owns navigation + readiness
  await studyPage.gotoStudyList();

  // ✅ LEFT ACTION: New Study
  await studyPage.actions.openNewStudy();

  // ✅ Assert only what TC001 is meant to assert
  expect(await studyPage.isBreadcrumbVisible()).toBeTruthy();
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
    const studyPage = new StudyManagementPage(page);

    // ✅ Navigate using full hierarchy
    await studyPage.gotoStudyList();

    // ✅ Search + select exact study
    await studyPage.searchStudy("SDY-001");
    await studyPage.selectStudyRowByStudyNo("SDY-001");

    // ✅ LEFT ACTION: Configure Study
    await studyPage.actions.configureSelectedStudy();

    // ✅ Validate navigation + correctness
    expect(await studyPage.isBreadcrumbVisible()).toBeTruthy();
    expect(await studyPage.getStudyNumber()).toContain("SDY-001");

    await page.context().close();
  }
});
