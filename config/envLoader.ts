import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const moduleFile = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFile);

/**
 * ✅ FINAL UserConfig exposed to the framework
 * Tenant is ALWAYS a single string after loading
 * Role is metadata only (never used in logic)
 */
export interface UserConfig {
  username: string;
  password: string;
  tenant: string;
  role: string;
  enabled: boolean;
}

/**
 * ❗ Raw user shape as it exists in JSON on disk
 * (supports legacy configs ONLY during parsing)
 */
interface RawUserConfig {
  username: string;
  password: string;
  tenant: string | string[];
  role: string;
  enabled: boolean;
}

export interface TimeoutConfig {
  navigation: number;
  adfs: number;
  default: number;
}

interface RawEnvironmentConfig {
  environment: string;
  baseUrl: string;
  users: RawUserConfig[];
  timeout: TimeoutConfig;
}

export interface EnvironmentConfig {
  environment: string;
  baseUrl: string;
  users: UserConfig[];
  timeout: TimeoutConfig;
}

export class EnvLoader {
  private static config: EnvironmentConfig | null = null;
  private static currentEnv = "";

  static loadConfig(): EnvironmentConfig {
    const env = (process.env.ENV || "val").toLowerCase();

    if (this.config && this.currentEnv === env) {
      return this.config;
    }

    const configPath = path.join(moduleDir, "env", `${env}.json`);
    if (!fs.existsSync(configPath)) {
      throw new Error(`❌ Environment configuration not found: ${configPath}`);
    }

    const raw = JSON.parse(
      fs.readFileSync(configPath, "utf-8"),
    ) as RawEnvironmentConfig;

    // ✅ Normalize & validate users (LOCKED TENANT RULE)
    const users: UserConfig[] = raw.users.map((user) => {
      let tenant: string;

      if (Array.isArray(user.tenant)) {
        if (user.tenant.length !== 1) {
          throw new Error(
            `❌ Invalid tenant configuration for ${user.username}. ` +
              `Multiple tenants found (${user.tenant.join(", ")}).`,
          );
        }
        tenant = user.tenant[0];
      } else {
        tenant = user.tenant;
      }

      if (typeof tenant !== "string" || tenant.trim() === "") {
        throw new Error(
          `❌ Invalid tenant configuration for ${user.username}.`,
        );
      }

      return {
        username: user.username,
        password: user.password,
        tenant,
        role: user.role,
        enabled: user.enabled,
      };
    });

    const config: EnvironmentConfig = {
      environment: raw.environment,
      baseUrl: raw.baseUrl,
      users,
      timeout: raw.timeout,
    };

    this.config = config;
    this.currentEnv = env;

    console.log(`✅ Loaded ${env.toUpperCase()} environment configuration`);
    console.log(`   Base URL: ${config.baseUrl}`);
    console.log(
      `   Enabled users: ${config.users.filter((u) => u.enabled).length}`,
    );

    return config;
  }

  static getEnvironment(): string {
    return this.loadConfig().environment;
  }

  static getBaseUrl(): string {
    return this.loadConfig().baseUrl;
  }

  static getTimeouts(): TimeoutConfig {
    return this.loadConfig().timeout;
  }

  static getUsers(): UserConfig[] {
    return this.loadConfig().users.filter((u) => u.enabled);
  }

  /**
   * ✅ ONLY supported user lookup
   */
  static getUserByUsername(username: string): UserConfig {
    const user = this.getUsers().find((u) => u.username === username);
    if (!user) {
      throw new Error(`❌ User not found or disabled: ${username}`);
    }
    return user;
  }

  static reloadConfig(): EnvironmentConfig {
    this.config = null;
    this.currentEnv = "";
    return this.loadConfig();
  }
}
