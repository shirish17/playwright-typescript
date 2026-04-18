import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";

import { fileURLToPath } from "url";

const moduleFile = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFile);

/**
 * One CSV row = one execution instance.
 * Pure data only.
 */
export interface TestScenarioRow {
  testId: string;
  testName: string;

  /**
   * Ordered, comma-separated usernames.
   * Example:
   * "Validation11@sitero.com,Validation13@sitero.com"
   */
  users: string;

  // Business data
  sponsorRef: string;
  testArticleRef: string;
  studyType: string;
  studyBlinding?: string;
  plannedSites?: number;
  plannedSubjects?: number;

  // Allow future columns without code change
  [key: string]: any;
}

/**
 * Reference (master) data structure.
 */
export interface ReferenceData {
  refId: string;
  [key: string]: any;
}

export class DataLoader {
  // ------------------------------
  // In-memory caches
  // ------------------------------
  private static scenarioCache: Map<string, TestScenarioRow[]> = new Map();
  private static referenceCache: Map<string, Map<string, ReferenceData>> =
    new Map();

  // ------------------------------
  // Scenario loading
  // ------------------------------
  static loadScenario(scenarioFile: string): TestScenarioRow[] {
    if (this.scenarioCache.has(scenarioFile)) {
      return this.scenarioCache.get(scenarioFile)!;
    }

    const filePath = path.join(moduleDir, "scenarios", scenarioFile);

    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ Scenario file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");

    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as TestScenarioRow[];

    // Minimal structural validation (NOT business logic)
    records.forEach((row, index) => {
      if (!row.testId || !row.testName) {
        throw new Error(
          `❌ Missing testId or testName at row ${index + 1} in ${scenarioFile}`,
        );
      }

      if (!row.users || typeof row.users !== "string") {
        throw new Error(
          `❌ Missing or invalid users field at row ${index + 1} in ${scenarioFile}`,
        );
      }
    });

    this.scenarioCache.set(scenarioFile, records);

    console.log(`📊 Loaded scenario: ${scenarioFile} (${records.length} rows)`);

    return records;
  }

  // ------------------------------
  // Reference loading
  // ------------------------------
  static loadReference(referenceFile: string): Map<string, ReferenceData> {
    if (this.referenceCache.has(referenceFile)) {
      return this.referenceCache.get(referenceFile)!;
    }

    const filePath = path.join(__dirname, "reference", referenceFile);

    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ Reference file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as ReferenceData[];

    const referenceMap = new Map<string, ReferenceData>();

    records.forEach((record) => {
      if (!record.refId) {
        throw new Error(
          `❌ Reference file ${referenceFile} contains a row without refId`,
        );
      }
      referenceMap.set(record.refId, record);
    });

    this.referenceCache.set(referenceFile, referenceMap);
    return referenceMap;
  }

  // ------------------------------
  // Reference resolution
  // ------------------------------
  static resolveReference(referenceFile: string, refId: string): ReferenceData {
    const referenceMap = this.loadReference(referenceFile);
    const data = referenceMap.get(refId);

    if (!data) {
      throw new Error(`❌ Reference not found: ${refId} in ${referenceFile}`);
    }

    return data;
  }

  // ------------------------------
  // Row resolution
  // ------------------------------
  static resolveTestData(row: TestScenarioRow): any {
    const resolved: any = { ...row };

    Object.keys(row).forEach((key) => {
      if (key.endsWith("Ref") && row[key]) {
        const refType = key.replace("Ref", "").toLowerCase();
        const referenceFile = `${refType}s.csv`;

        resolved[refType] = this.resolveReference(referenceFile, row[key]);
      }
    });

    return resolved;
  }

  // ------------------------------
  // High-level helpers
  // ------------------------------
  static getAllTestData(scenarioFile: string): any[] {
    return this.loadScenario(scenarioFile).map((row) =>
      this.resolveTestData(row),
    );
  }

  static clearCache(): void {
    this.scenarioCache.clear();
    this.referenceCache.clear();
    console.log("🧹 DataLoader cache cleared");
  }
}
