import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function parseCSV(content: string): string[][] {
  const lines = content.trim().split("\n");
  return lines.map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

export interface PollieListItem {
  slug: string;
  name: string;
  division: string;
  state: string;
  party: string;
}

declare const data: PollieListItem[];
export { data };

export default {
  watch: ["../data/representatives.csv"],
  load(): PollieListItem[] {
    const csvPath = resolve(rootDir, "data/representatives.csv");
    if (!existsSync(csvPath)) {
      return [];
    }

    const content = readFileSync(csvPath, "utf-8");
    const rows = parseCSV(content);
    const [, ...dataRows] = rows;

    const pollieMap = new Map<
      string,
      { row: string[]; ceasedDate: Date | null }
    >();

    for (const row of dataRows) {
      if (!row[2]) continue;

      const slug = slugify(row[2]);
      const ceasedDate = parseDate(row[7]);
      const existing = pollieMap.get(slug);

      if (!existing) {
        pollieMap.set(slug, { row, ceasedDate });
      } else {
        // Prefer entry still in office (null ceasedDate)
        // Otherwise prefer most recent ceasedDate
        const existingStillInOffice = existing.ceasedDate === null;
        const newStillInOffice = ceasedDate === null;

        if (newStillInOffice && !existingStillInOffice) {
          pollieMap.set(slug, { row, ceasedDate });
        } else if (
          !existingStillInOffice &&
          !newStillInOffice &&
          ceasedDate &&
          existing.ceasedDate &&
          ceasedDate > existing.ceasedDate
        ) {
          pollieMap.set(slug, { row, ceasedDate });
        }
      }
    }

    return Array.from(pollieMap.values()).map(({ row }) => ({
      slug: slugify(row[2]),
      name: row[2],
      division: row[3] || "",
      state: row[4] || "",
      party: row[9] || "",
    }));
  },
};
