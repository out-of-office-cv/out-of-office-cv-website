import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Pollie, House } from "./types";
import { parseCSV, slugify, deduplicatePollies } from "./utils";

function buildPhotoUrl(phid: string): string {
  return `https://www.aph.gov.au/api/parliamentarian/${phid}/image`;
}

export function loadPollies(dataDir: string): Pollie[] {
  const csvPath = resolve(dataDir, "pollies.csv");
  if (!existsSync(csvPath)) {
    return [];
  }

  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  const pollies: Pollie[] = [];
  for (const row of rows.slice(1)) {
    if (!row[1]) continue;

    const ceasedDate = row[5] || "";
    const stillInOffice = !ceasedDate;
    const phid = row[0];

    pollies.push({
      slug: slugify(row[1]),
      phid,
      name: row[1],
      division: row[2] || "",
      state: row[3] || "",
      party: row[4] || "",
      ceasedDate,
      stillInOffice,
      house: (row[6] as House) || "reps",
      photoUrl: buildPhotoUrl(phid),
    });
  }

  return deduplicatePollies(pollies);
}
