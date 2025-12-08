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
  watch: ["./data/representatives.csv", "./data/senators.csv"],
  load(): PolliesByDecade[] {
    const repsCsvPath = resolve(rootDir, "data/representatives.csv");
    const senatorsCsvPath = resolve(rootDir, "data/senators.csv");

    const dataRows: { row: string[]; house: "reps" | "senate" }[] = [];

    if (existsSync(repsCsvPath)) {
      const content = readFileSync(repsCsvPath, "utf-8");
      const rows = parseCSV(content);
      dataRows.push(
        ...rows.slice(1).map((row) => ({ row, house: "reps" as const })),
      );
    }

    if (existsSync(senatorsCsvPath)) {
      const content = readFileSync(senatorsCsvPath, "utf-8");
      const rows = parseCSV(content);
      dataRows.push(
        ...rows.slice(1).map((row) => ({ row, house: "senate" as const })),
      );
    }

    if (dataRows.length === 0) {
      return [];
    }

    const pollieMap = new Map<
      string,
      { row: string[]; ceasedDate: Date | null; house: "reps" | "senate" }
    >();

    for (const { row, house } of dataRows) {
      if (!row[2]) continue;

      const slug = slugify(row[2]);
      const ceasedDate = parseDate(row[7]);
      const existing = pollieMap.get(slug);

      if (!existing) {
        pollieMap.set(slug, { row, ceasedDate, house });
      } else {
        const existingStillInOffice = existing.ceasedDate === null;
        const newStillInOffice = ceasedDate === null;

        if (newStillInOffice && !existingStillInOffice) {
          pollieMap.set(slug, { row, ceasedDate, house });
        } else if (
          !existingStillInOffice &&
          !newStillInOffice &&
          ceasedDate &&
          existing.ceasedDate &&
          ceasedDate > existing.ceasedDate
        ) {
          pollieMap.set(slug, { row, ceasedDate, house });
        }
      }
    }

    const pollies: PollieWithParsedDate[] = Array.from(pollieMap.values())
      .map(({ row, ceasedDate, house }) => ({
        slug: slugify(row[2]),
        name: row[2],
        division: row[3] || "",
        state: row[4] || "",
        party: row[9] || "",
        ceasedDate: row[7] || "",
        house,
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
