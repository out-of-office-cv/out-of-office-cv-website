import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, existsSync, rmSync } from "node:fs";
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
