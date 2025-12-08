import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCSV, slugify } from "./.vitepress/utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

export interface PollieOption {
  slug: string;
  name: string;
}

declare const data: PollieOption[];
export { data };

export default {
  watch: ["./data/representatives.csv", "./data/senators.csv"],
  load(): PollieOption[] {
    const repsCsvPath = resolve(rootDir, "data/representatives.csv");
    const senatorsCsvPath = resolve(rootDir, "data/senators.csv");

    const pollieMap = new Map<string, string>();

    if (existsSync(repsCsvPath)) {
      const content = readFileSync(repsCsvPath, "utf-8");
      const rows = parseCSV(content);
      for (const row of rows.slice(1)) {
        if (row[2]) {
          const slug = slugify(row[2]);
          if (!pollieMap.has(slug)) {
            pollieMap.set(slug, row[2]);
          }
        }
      }
    }

    if (existsSync(senatorsCsvPath)) {
      const content = readFileSync(senatorsCsvPath, "utf-8");
      const rows = parseCSV(content);
      for (const row of rows.slice(1)) {
        if (row[2]) {
          const slug = slugify(row[2]);
          if (!pollieMap.has(slug)) {
            pollieMap.set(slug, row[2]);
          }
        }
      }
    }

    return Array.from(pollieMap.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};
