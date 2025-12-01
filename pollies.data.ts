import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PollieListItem, PolliesByDecade } from "./.vitepress/types";
import { parseCSV, slugify, parseDate } from "./.vitepress/utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

declare const data: PolliesByDecade[];
export { data };
export type { PollieListItem, PolliesByDecade };

function getDecade(date: Date | null): string {
  if (!date) return "Current";
  const year = date.getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

interface PollieWithParsedDate extends PollieListItem {
  _ceasedDateParsed: Date | null;
}

export default {
  watch: ["./data/representatives.csv"],
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

    const pollies: PollieWithParsedDate[] = Array.from(pollieMap.values())
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
        if (!a._ceasedDateParsed && b._ceasedDateParsed) return -1;
        if (a._ceasedDateParsed && !b._ceasedDateParsed) return 1;
        if (a._ceasedDateParsed && b._ceasedDateParsed) {
          return b._ceasedDateParsed.getTime() - a._ceasedDateParsed.getTime();
        }
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
