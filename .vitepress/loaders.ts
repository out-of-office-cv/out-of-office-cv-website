import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Pollie, House } from "./types";
import { parseCSV, parsePollieFromRow, deduplicatePollies } from "./utils";

export function loadPollies(dataDir: string): Pollie[] {
  const pollies: Pollie[] = [];

  for (const { file, house } of [
    { file: "representatives.csv", house: "reps" as House },
    { file: "senators.csv", house: "senate" as House },
  ]) {
    const csvPath = resolve(dataDir, file);
    if (!existsSync(csvPath)) continue;

    const content = readFileSync(csvPath, "utf-8");
    const rows = parseCSV(content);

    for (const row of rows.slice(1)) {
      if (!row[2]) continue;
      pollies.push(parsePollieFromRow(row, house));
    }
  }

  return deduplicatePollies(pollies);
}
