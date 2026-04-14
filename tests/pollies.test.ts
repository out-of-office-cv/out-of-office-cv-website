import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import type { Gig } from "../src/types";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const distPolliesDir = resolve(distDir, "pollies");
const gigsJsonPath = resolve(rootDir, "data/gigs.json");

describe("pollie page generation", () => {
  beforeAll(() => {
    execSync("pnpm run build", { cwd: rootDir, stdio: "pipe" });
  }, 120_000);

  it("generates pollie html pages", () => {
    expect(existsSync(distPolliesDir)).toBe(true);
  });

  it("generates index with links to pollies", () => {
    const index = readFileSync(resolve(distDir, "index.html"), "utf-8");
    expect(index).toContain("Out of Office");
    expect(index).toContain("Tony Abbott");
    expect(index).toContain("/pollies/tony-abbott");
  });

  it("filters out pollies from before the 1980s on the index", () => {
    const index = readFileSync(resolve(distDir, "index.html"), "utf-8");
    expect(index).not.toMatch(/1970s/);
    expect(index).not.toMatch(/1960s/);
    expect(index).not.toMatch(/1950s/);
    expect(index).toContain("1980s");
  });

  it("generates individual pollie pages with correct content", () => {
    const abbottDir = resolve(distPolliesDir, "tony-abbott");
    const abbottPath = resolve(abbottDir, "index.html");
    expect(existsSync(abbottPath)).toBe(true);

    const content = readFileSync(abbottPath, "utf-8");
    expect(content).toContain("Tony Abbott");
    expect(content).toContain("Electorate");
    expect(content).toContain("Warringah");
    expect(content).toContain("NSW");
    expect(content).toContain("LIB");
  });

  it("includes left office date for former members", () => {
    const abbottPath = resolve(distPolliesDir, "tony-abbott/index.html");
    expect(existsSync(abbottPath)).toBe(true);

    const content = readFileSync(abbottPath, "utf-8");
    expect(content).toContain("Left office");
    expect(content).toContain("18 May 2019");
    expect(content).toMatch(/\d+ years? ago/);
  });

  it("generates correct number of pollie pages", () => {
    const dirs = readdirSync(distPolliesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    expect(dirs.length).toBeGreaterThan(700);
  });

  it("deduplicates pollies with multiple terms, keeping most recent", () => {
    const broadbentPath = resolve(
      distPolliesDir,
      "russell-broadbent/index.html",
    );
    expect(existsSync(broadbentPath)).toBe(true);

    const page = readFileSync(broadbentPath, "utf-8");
    const header = page.match(
      /<header class="pollie-masthead[\s\S]*?<\/header>/,
    )?.[0] ?? "";
    expect(header).toContain("Monash");
    expect(header).toContain("IND");
    expect(header).not.toContain("Corinella");
    expect(header).not.toContain("McMillan");
  });
});

describe("gig integration", () => {
  let originalGigsJson: string;

  beforeAll(() => {
    originalGigsJson = readFileSync(gigsJsonPath, "utf-8");

    const testGigs: Gig[] = [
      {
        role: "Board Member",
        organisation: "Test Corp",
        category: "Professional Services & Management Consulting",
        sources: ["https://example.com/source"],
        pollie_slug: "tony-abbott",
        start_date: "2020-06-15",
        verified_by: "test",
      },
      {
        role: "Advisor",
        organisation: "Another Org",
        category: "Government, Public Administration & Civil Service",
        sources: ["https://example.com/other"],
        pollie_slug: "tony-abbott",
        start_date: "2021-01-01",
        end_date: "2022-12-31",
        verified_by: "test",
      },
    ];
    writeFileSync(gigsJsonPath, JSON.stringify(testGigs, null, 2) + "\n");
    execSync("pnpm run build", { cwd: rootDir, stdio: "pipe" });
  }, 120_000);

  afterAll(() => {
    writeFileSync(gigsJsonPath, originalGigsJson);
  });

  it("includes gigs section on pollie page", () => {
    const abbottPath = resolve(
      distPolliesDir,
      "tony-abbott/index.html",
    );
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain("Post-office roles");
    expect(content).toContain("Board Member");
    expect(content).toContain("Test Corp");
    expect(content).toContain(
      "Professional Services &amp; Management Consulting",
    );
    expect(content).toContain("15 June 2020");
    expect(content).toContain("present");
  });

  it("formats gig date ranges correctly", () => {
    const abbottPath = resolve(
      distPolliesDir,
      "tony-abbott/index.html",
    );
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain("Advisor");
    expect(content).toContain("1 January 2021");
    expect(content).toContain("31 December 2022");
  });

  it("includes source links for gigs", () => {
    const abbottPath = resolve(
      distPolliesDir,
      "tony-abbott/index.html",
    );
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain("https://example.com/source");
    expect(content).toContain("https://example.com/other");
  });

  it("shows no gigs message for pollies without gigs", () => {
    const broadbentPath = resolve(
      distPolliesDir,
      "russell-broadbent/index.html",
    );
    const content = readFileSync(broadbentPath, "utf-8");

    expect(content).toContain("Post-office roles");
    expect(content).toContain("No post-office roles recorded yet");
    expect(content).toContain("Help us add it");
  });
});
