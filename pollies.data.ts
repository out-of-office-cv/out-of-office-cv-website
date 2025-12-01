import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

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
  ceasedDate: string;
}

export interface PolliesByDecade {
  decade: string;
  pollies: PollieListItem[];
}

declare const data: PolliesByDecade[];
export { data };

function getDecade(date: Date | null): string {
  if (!date) return "Current";
  const year = date.getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

export default {
  watch: ["../data/representatives.csv"],
  load(): PolliesByDecade[] {
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

    const pollies = Array.from(pollieMap.values())
      .map(({ row, ceasedDate }) => ({
        slug: slugify(row[2]),
        name: row[2],
        division: row[3] || "",
        state: row[4] || "",
        party: row[9] || "",
        ceasedDate: row[7] || "",
        _ceasedDateParsed: ceasedDate,
      }))
      .sort((a, b) => {
        // Current members first
        if (!a._ceasedDateParsed && b._ceasedDateParsed) return -1;
        if (a._ceasedDateParsed && !b._ceasedDateParsed) return 1;
        // Then by date descending (most recent first)
        if (a._ceasedDateParsed && b._ceasedDateParsed) {
          return b._ceasedDateParsed.getTime() - a._ceasedDateParsed.getTime();
        }
        // Alphabetical for current members
        return a.name.localeCompare(b.name);
      });

    const decadeMap = new Map<string, PollieListItem[]>();
    for (const pollie of pollies) {
      const decade = getDecade(pollie._ceasedDateParsed);
      const list = decadeMap.get(decade) || [];
      const { _ceasedDateParsed, ...pollieData } = pollie;
      list.push(pollieData);
      decadeMap.set(decade, list);
    }

    const decadeOrder = [
      "Current",
      ...Array.from(decadeMap.keys())
        .filter((d) => d !== "Current")
        .sort((a, b) => b.localeCompare(a)),
    ];

    return decadeOrder
      .filter((decade) => decadeMap.has(decade))
      .map((decade) => ({
        decade,
        pollies: decadeMap.get(decade)!,
      }));
  },
};
