// Playwright framework
import { test as base, Page } from "@playwright/test";

// Infrastructure dependencies
import { EnvLoader } from "@config/envLoader.js";
import { AuthManager } from "@auth/authManager.js";

// ===============================
// Fixture Types
// ===============================

type AuthFixtures = {
  authPage: (username: string) => Promise<Page>;
};

// ===============================
// Auth Fixture
// ===============================

/**
 * Auth fixture responsibility:
 * - Given a username
 * - Return an authenticated Page
 *
 * RULES:
 * - No DataLoader usage
 * - No testId parsing
 * - No role logic
 * - No tenant logic
 * - No business branching
 */
export const test = base.extend<AuthFixtures>({
  authPage: async ({ browser }, use) => {
    await use(async (username: string) => {
      // Resolve user configuration
      const user = EnvLoader.getUserByUsername(username);

      // Ensure authenticated + tenant-verified session
      const storageState = await AuthManager.getOrCreateStorageState(user);

      // Create isolated browser context
      const context = await browser.newContext({
        storageState,
        ignoreHTTPSErrors: true,
        baseURL: EnvLoader.getBaseUrl(),
      });

      // Return ready-to-use page
      return await context.newPage();
    });
  },
});

// ===============================
// Re-export expect
// ===============================

export { expect } from "@playwright/test";
