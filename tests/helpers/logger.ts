import { test, TestInfo } from "@playwright/test";
import chalk from "chalk";

type Level = "log" | "info" | "warn" | "error";

function serialize(message: unknown): string {
  if (typeof message === "string") return message;
  try {
    return JSON.stringify(message, null, 2);
  } catch {
    return String(message);
  }
}

export async function log(level: Level, message: unknown, testInfo?: TestInfo) {
  const serialized = serialize(message);
  const plainLine = `[${level.toUpperCase()}]: ${serialized}`;
  let coloredLine: string;

  switch (level) {
    case "info":
      coloredLine = chalk.blue(plainLine);
      break;
    case "warn":
      coloredLine = chalk.yellow(plainLine);
      break;
    case "error":
      coloredLine = chalk.red(plainLine);
      break;
    default:
      coloredLine = chalk.gray(plainLine);
  }

  const fn = (console[level] ?? console.log) as (...args: unknown[]) => void;
  fn(coloredLine);

  // test.step() exists on `test`, not on `testInfo`
  if (testInfo) {
    await test.step(plainLine, async () => {});
  }
}
