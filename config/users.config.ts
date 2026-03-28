import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export interface UserCredentials {
  username: string;
  password: string;
  envKey: string;
  storageStatePath: string;
}

export class UserConfig {
  private static users: Map<string, UserCredentials> = new Map();

  /**
   * Discovers all users from environment variables
   * Expects format: VALIDATION11_USERNAME, VALIDATION11_PASSWORD
   */
  static discoverUsers(): Map<string, UserCredentials> {
    if (this.users.size > 0) {
      return this.users;
    }

    const userPattern = /^(.+)_USERNAME$/;
    const discoveredUsers = new Set<string>();

    // Scan environment variables for username entries
    Object.keys(process.env).forEach((key) => {
      const match = key.match(userPattern);
      if (match) {
        const baseKey = match[1]; // e.g., "VALIDATION11"
        discoveredUsers.add(baseKey);
      }
    });

    // Build user credentials map
    discoveredUsers.forEach((baseKey) => {
      const username = process.env[`${baseKey}_USERNAME`];
      const password = process.env[`${baseKey}_PASSWORD`];

      if (!username || !password) {
        console.warn(
          `⚠️  Skipping ${baseKey}: Missing username or password in .env`,
        );
        return;
      }

      const storageStatePath = path.join(
        __dirname,
        "..",
        "auth",
        "storageStates",
        `${baseKey.toLowerCase()}.json`,
      );

      this.users.set(baseKey, {
        username,
        password,
        envKey: baseKey,
        storageStatePath,
      });
    });

    console.log(`✅ Discovered ${this.users.size} users from environment`);
    return this.users;
  }

  static getUserByKey(envKey: string): UserCredentials | undefined {
    this.discoverUsers();
    return this.users.get(envKey);
  }

  static getAllUsers(): UserCredentials[] {
    this.discoverUsers();
    return Array.from(this.users.values());
  }

  static getUserByUsername(username: string): UserCredentials | undefined {
    this.discoverUsers();
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
}
