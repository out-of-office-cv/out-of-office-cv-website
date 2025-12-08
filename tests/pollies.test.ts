import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, ".vitepress/dist");
const distPolliesDir = resolve(distDir, "pollies");
const gigsPath = resolve(rootDir, "data/gigs.ts");

describe("pollie page generation", () => {
  beforeAll(() => {
    execSync("npm run build", { cwd: rootDir, stdio: "pipe" });
  });

  it("generates pollie html pages", () => {
    expect(existsSync(distPolliesDir)).toBe(true);
  });

  it("generates index with links to pollies", () => {
    const index = readFileSync(resolve(distDir, "index.html"), "utf-8");
    expect(index).toContain("Out of Office");
    expect(index).toContain("Anthony Norman Albanese");
    expect(index).toContain("/pollies/anthony-norman-albanese");
  });

  it("filters out pollies from before the 1980s on the index", () => {
    const index = readFileSync(resolve(distDir, "index.html"), "utf-8");
    expect(index).not.toMatch(/1970s/);
    expect(index).not.toMatch(/1960s/);
    expect(index).not.toMatch(/1950s/);
    expect(index).toContain("1980s");
  });

  it("generates individual pollie pages with correct content", () => {
    const albanesePath = resolve(
      distPolliesDir,
      "anthony-norman-albanese.html",
    );
    expect(existsSync(albanesePath)).toBe(true);

    const content = readFileSync(albanesePath, "utf-8");
    expect(content).toContain("Anthony Norman Albanese");
    expect(content).toContain("Electorate");
    expect(content).toContain("Grayndler");
    expect(content).toContain("NSW");
    expect(content).toContain("ALP");
    expect(content).toContain("In office");
  });

  it("includes left office date for former members", () => {
    const abbottPath = resolve(distPolliesDir, "anthony-john-abbott.html");
    expect(existsSync(abbottPath)).toBe(true);

    const content = readFileSync(abbottPath, "utf-8");
    expect(content).toContain("Left office");
    expect(content).toContain("18 May 2019");
    expect(content).toMatch(/\d+ years? ago/);
  });

  it("generates correct number of pollie pages", () => {
    const files = readdirSync(distPolliesDir).filter(
      (f: string) => f.endsWith(".html") && f !== "index.html",
    );
    expect(files.length).toBeGreaterThan(700);
  });

  it("deduplicates pollies with multiple terms, keeping most recent", () => {
    // Russell Broadbent has 5 entries in the CSV spanning 1990-2025
    // Should show his most recent term (Monash, IND, defeated 2025)
    const broadbentPath = resolve(
      distPolliesDir,
      "russell-evan-broadbent.html",
    );
    expect(existsSync(broadbentPath)).toBe(true);

    const content = readFileSync(broadbentPath, "utf-8");
    expect(content).toContain("Monash"); // most recent electorate (2019-2025)
    expect(content).toContain("IND"); // party from final term
    expect(content).not.toContain("Corinella"); // first electorate (1990-1993)
    expect(content).not.toContain("McMillan"); // middle electorate
  });
});

describe("gig integration", () => {
  let originalGigs: string;

  beforeAll(() => {
    originalGigs = readFileSync(gigsPath, "utf-8");

    const testGigs = `import type { Gig } from "../.vitepress/types"

export const gigs: Gig[] = [
  {
    role: "Board Member",
    organisation: "Test Corp",
    category: "Professional Services & Management Consulting",
    sources: ["https://example.com/source"],
    pollie_slug: "anthony-john-abbott",
    start_date: "2020-06-15",
    verified_by: "test",
  },
  {
    role: "Advisor",
    organisation: "Another Org",
    category: "Government, Public Administration & Civil Service",
    sources: ["https://example.com/other"],
    pollie_slug: "anthony-john-abbott",
    start_date: "2021-01-01",
    end_date: "2022-12-31",
    verified_by: "test",
  },
]
`;
    writeFileSync(gigsPath, testGigs);
    execSync("npm run build", { cwd: rootDir, stdio: "pipe" });
  });

  afterAll(() => {
    writeFileSync(gigsPath, originalGigs);
  });

  it("includes gigs section on pollie page", () => {
    const abbottPath = resolve(distPolliesDir, "anthony-john-abbott.html");
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
    const abbottPath = resolve(distPolliesDir, "anthony-john-abbott.html");
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain("Advisor");
    expect(content).toContain("1 January 2021");
    expect(content).toContain("31 December 2022");
  });

  it("includes source links for gigs", () => {
    const abbottPath = resolve(distPolliesDir, "anthony-john-abbott.html");
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain("https://example.com/source");
    expect(content).toContain("https://example.com/other");
  });

  it("does not include gigs section for pollies without gigs", () => {
    const albanesePath = resolve(
      distPolliesDir,
      "anthony-norman-albanese.html",
    );
    const content = readFileSync(albanesePath, "utf-8");

    expect(content).not.toContain("Post-office roles");
  });
});
