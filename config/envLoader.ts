import fs from "fs";
import path from "path";

export interface EnvConfig {
  env: "dev" | "val" | "uat";
  baseUrl: string;
  tenantName: string;
}

const ENV = (process.env.ENV || "val").toLowerCase();
const envFilePath = path.resolve(__dirname, "env", `${ENV}.json`);
if (!fs.existsSync(envFilePath)) {
  throw new Error(`Environment config not found for ENV=${ENV}`);
}
export const envConfig: EnvConfig = JSON.parse(
  fs.readFileSync(envFilePath, "utf-8"),
);
