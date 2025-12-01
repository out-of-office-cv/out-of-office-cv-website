import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..");
const polliesDir = resolve(rootDir, "pollies");

describe("pollie generation", () => {
  beforeAll(() => {
    rmSync(polliesDir, { recursive: true, force: true });
    execSync("npm run build", { cwd: rootDir, stdio: "pipe" });
  });

  afterAll(() => {
    rmSync(polliesDir, { recursive: true, force: true });
  });

  it("generates pollie markdown files", () => {
    expect(existsSync(polliesDir)).toBe(true);
    expect(existsSync(resolve(polliesDir, "index.md"))).toBe(true);
  });

  it("generates index with links to all pollies", () => {
    const index = readFileSync(resolve(polliesDir, "index.md"), "utf-8");
    expect(index).toContain("# Pollies");
    expect(index).toContain("Anthony Norman Albanese");
    expect(index).toContain("/pollies/anthony-norman-albanese");
  });

  it("generates individual pollie pages with correct content", () => {
    const albanesePath = resolve(polliesDir, "anthony-norman-albanese.md");
    expect(existsSync(albanesePath)).toBe(true);

    const content = readFileSync(albanesePath, "utf-8");
    expect(content).toContain('title: "Anthony Norman Albanese"');
    expect(content).toContain("# Anthony Norman Albanese");
    expect(content).toContain("<dt>Electorate</dt>");
    expect(content).toContain("<dd>Grayndler</dd>");
    expect(content).toContain("<dd>NSW</dd>");
    expect(content).toContain("<dd>ALP</dd>");
    expect(content).toContain("<dd>In office</dd>");
  });

  it("includes left office date for former members", () => {
    const abbottPath = resolve(polliesDir, "anthony-john-abbott.md");
    expect(existsSync(abbottPath)).toBe(true);

    const content = readFileSync(abbottPath, "utf-8");
    expect(content).toContain("<dt>Left office</dt>");
    expect(content).toContain("18 May 2019");
    expect(content).toMatch(/\d+ years? ago/);
  });

  it("generates correct number of pollie pages", () => {
    const { readdirSync } = require("node:fs");
    const files = readdirSync(polliesDir).filter(
      (f: string) => f.endsWith(".md") && f !== "index.md",
    );
    expect(files.length).toBeGreaterThan(700);
  });
});

describe("gig integration", () => {
  const gigsPath = resolve(rootDir, "data/gigs.ts");
  let originalGigs: string;

  beforeAll(() => {
    originalGigs = readFileSync(gigsPath, "utf-8");

    const testGigs = `import type { Gig } from "../.vitepress/types"

export const gigs: Gig[] = [
  {
    role: "Board Member",
    organisation: "Test Corp",
    category: "consulting",
    verified_by: "https://example.com/source",
    pollie_slug: "anthony-john-abbott",
    start_date: "2020-06-15",
  },
  {
    role: "Advisor",
    organisation: "Another Org",
    category: "lobbying",
    verified_by: "https://example.com/other",
    pollie_slug: "anthony-john-abbott",
    start_date: "2021-01-01",
    end_date: "2022-12-31",
  },
]
`;
    writeFileSync(gigsPath, testGigs);
    rmSync(polliesDir, { recursive: true, force: true });
    execSync("npm run build", { cwd: rootDir, stdio: "pipe" });
  });

  afterAll(() => {
    writeFileSync(gigsPath, originalGigs);
    rmSync(polliesDir, { recursive: true, force: true });
  });

  it("includes gigs section on pollie page", () => {
    const abbottPath = resolve(polliesDir, "anthony-john-abbott.md");
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain("## Post-office roles");
    expect(content).toContain("<dt>Board Member</dt>");
    expect(content).toContain("Test Corp (consulting)");
    expect(content).toContain("15 June 2020");
    expect(content).toContain("present");
  });

  it("formats gig date ranges correctly", () => {
    const abbottPath = resolve(polliesDir, "anthony-john-abbott.md");
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain("<dt>Advisor</dt>");
    expect(content).toContain("1 January 2021 – 31 December 2022");
  });

  it("includes source links for gigs", () => {
    const abbottPath = resolve(polliesDir, "anthony-john-abbott.md");
    const content = readFileSync(abbottPath, "utf-8");

    expect(content).toContain('href="https://example.com/source"');
    expect(content).toContain('href="https://example.com/other"');
  });

  it("does not include gigs section for pollies without gigs", () => {
    const albanesePath = resolve(polliesDir, "anthony-norman-albanese.md");
    const content = readFileSync(albanesePath, "utf-8");

    expect(content).not.toContain("## Post-office roles");
  });
});
