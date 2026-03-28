import { FullConfig } from "@playwright/test";
import { AuthManager } from "./authManager";
import { UserConfig } from "../config/users.config";

/**
 * Global setup - runs once before all tests
 * Pre-authenticates all users to avoid login during test execution
 */
async function globalSetup(config: FullConfig) {
  console.log("\n🚀 Starting global authentication setup...\n");

  const users = UserConfig.getAllUsers();

  if (users.length === 0) {
    console.warn("⚠️  No users found in environment variables");
    return;
  }

  // Authenticate all users in parallel
  const authPromises = users.map((user) =>
    AuthManager.getOrCreateStorageState(user, config).catch((error) => {
      console.error(`❌ Failed to authenticate ${user.envKey}:`, error);
      throw error;
    }),
  );

  await Promise.all(authPromises);

  console.log("\n✅ Global authentication setup complete!\n");
}

export default globalSetup;
