import type {
  Reporter,
  Suite,
  TestCase,
  TestResult,
  FullConfig,
  FullResult,
} from "@playwright/test/reporter";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface RunManifest {
  project: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  tag: string;
  environment: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  durationSeconds: number;
  triggeredBy: string;
}

export default class AllureOrganizerReporter implements Reporter {
  private startTime!: Date;
  private manifest: Partial<RunManifest> = {};
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private flaky = 0;
  private totalTests = 0;

  private readonly rawResultsDir = path.resolve("allure-results");
  private readonly runRoot = path.resolve("allure-results");
  private readonly reportRoot = path.resolve("allure-report");
  private runFolderPath!: string;

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = new Date();

    const project = process.env.PROJECT_NAME ?? "CRO";
    const env = process.env.TEST_ENV ?? "local";
    const tag = process.env.TEST_TAG ?? "regression";
    const triggeredBy =
      process.env.CI_TRIGGERED_BY ?? process.env.USERNAME ?? "local-dev";

    const year = this.startTime.getFullYear().toString();
    const month = String(this.startTime.getMonth() + 1).padStart(2, "0");
    const monthName = this.startTime.toLocaleString("en-GB", { month: "long" });
    const monthFolder = `${month}-${monthName}`;

    const dateStamp = this.formatDate(this.startTime);
    const runFolderName = `${tag}_${env}_${dateStamp}`;

    this.runFolderPath = path.join(
      this.runRoot,
      project,
      year,
      monthFolder,
      runFolderName,
    );

    fs.mkdirSync(this.runFolderPath, { recursive: true });

    this.manifest = {
      project,
      runId: runFolderName,
      startedAt: this.startTime.toISOString(),
      tag,
      environment: env,
      triggeredBy,
    };
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    this.totalTests++;
    if (result.status === "passed") this.passed++;
    else if (result.status === "failed") this.failed++;
    else if (result.status === "skipped") this.skipped++;
    if (result.status === "passed" && result.retry > 0) this.flaky++;
  }

  async onEnd(_result: FullResult): Promise<void> {
    const finishedAt = new Date();
    const durationSeconds = Math.round(
      (finishedAt.getTime() - this.startTime.getTime()) / 1000,
    );

    const fullManifest: RunManifest = {
      ...(this.manifest as RunManifest),
      finishedAt: finishedAt.toISOString(),
      totalTests: this.totalTests,
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      flaky: this.flaky,
      durationSeconds,
    };

    fs.writeFileSync(
      path.join(this.runFolderPath, "run-manifest.json"),
      JSON.stringify(fullManifest, null, 2),
    );

    // Copy allure result files
    if (fs.existsSync(this.rawResultsDir)) {
      for (const file of fs.readdirSync(this.rawResultsDir)) {
        if (!file.endsWith(".json") && !file.includes("attachment")) continue;
        fs.copyFileSync(
          path.join(this.rawResultsDir, file),
          path.join(this.runFolderPath, file),
        );
      }
    }

    // 🔥 TREND FIX: Copy history from previous report
    this.copyPreviousHistory();

    const project = this.manifest.project!;
    const tag = this.manifest.tag!;
    const env = this.manifest.environment!;
    const timestamp = this.manifest.runId!.split(`${tag}_${env}_`)[1];

    const year = this.startTime.getFullYear().toString();
    const month = String(this.startTime.getMonth() + 1).padStart(2, "0");
    const monthName = this.startTime.toLocaleString("en-GB", { month: "long" });
    const monthFolder = `${month}-${monthName}`;

    const reportOutputDir = path.join(
      this.reportRoot,
      project,
      year,
      monthFolder,
      `${tag}_${env}_${timestamp}`,
    );

    fs.mkdirSync(reportOutputDir, { recursive: true });

    execSync(
      `npx allure generate "${this.runFolderPath}" -o "${reportOutputDir}" --clean`,
      { stdio: "inherit" },
    );

    if (!process.env.CI) {
      execSync(`npx allure open "${reportOutputDir}"`, { stdio: "inherit" });
    }

    this.updateRunsIndex(fullManifest);
  }

  // 🔥 TREND FIX LOGIC
  private copyPreviousHistory(): void {
    const project = this.manifest.project!;
    const tag = this.manifest.tag!;
    const env = this.manifest.environment!;

    const reportProjectRoot = path.join(this.reportRoot, project);
    if (!fs.existsSync(reportProjectRoot)) return;

    const allReports: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, entry);
        if (fs.statSync(fullPath).isDirectory()) {
          if (entry.startsWith(`${tag}_${env}_`)) {
            allReports.push(fullPath);
          }
          walk(fullPath);
        }
      }
    };

    walk(reportProjectRoot);

    if (allReports.length === 0) return;

    allReports.sort().reverse();
    const latestReport = allReports[0];
    const historySource = path.join(latestReport, "history");
    const historyTarget = path.join(this.runFolderPath, "history");

    if (!fs.existsSync(historySource)) return;

    fs.mkdirSync(historyTarget, { recursive: true });
    for (const file of fs.readdirSync(historySource)) {
      fs.copyFileSync(
        path.join(historySource, file),
        path.join(historyTarget, file),
      );
    }
  }

  private updateRunsIndex(manifest: RunManifest): void {
    const indexPath = path.join(this.runRoot, "runs-index.json");
    let index: RunManifest[] = [];

    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      } catch {
        index = [];
      }
    }

    index.unshift(manifest);
    if (index.length > 500) index = index.slice(0, 500);
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }

  private formatDate(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}`;
  }
}