import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pollie, Gig } from "../.vitepress/types";
import {
  parseCSV,
  slugify,
  parseDate,
  formatDate,
  formatISODate,
  timeAgo,
} from "../.vitepress/utils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

function loadPollies(): Pollie[] {
  const repsCsvPath = resolve(rootDir, "data/representatives.csv");
  const senatorsCsvPath = resolve(rootDir, "data/senators.csv");

  const dataRows: string[][] = [];

  if (existsSync(repsCsvPath)) {
    const content = readFileSync(repsCsvPath, "utf-8");
    const rows = parseCSV(content);
    dataRows.push(...rows.slice(1));
  }

  if (existsSync(senatorsCsvPath)) {
    const content = readFileSync(senatorsCsvPath, "utf-8");
    const rows = parseCSV(content);
    dataRows.push(...rows.slice(1));
  }

  if (dataRows.length === 0) {
    return [];
  }

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

  return Array.from(pollieMap.values()).map(({ row }) => ({
    slug: slugify(row[2]),
    name: row[2],
    division: row[3] || "",
    state: row[4] || "",
    party: row[9] || "",
    ceasedDate: row[7] || "",
    reason: row[8] || "",
    stillInOffice: row[8] === "still_in_office",
  }));
}

async function loadGigs(): Promise<Gig[]> {
  const gigsPath = resolve(rootDir, "data/gigs.ts");
  if (!existsSync(gigsPath)) {
    return [];
  }
  const module = await import(`${gigsPath}?t=${Date.now()}`);
  return module.gigs || [];
}

function getGigsByPollie(gigs: Gig[]): Map<string, Gig[]> {
  const gigsByPollie = new Map<string, Gig[]>();
  for (const gig of gigs) {
    const existing = gigsByPollie.get(gig.pollie_slug) || [];
    existing.push(gig);
    gigsByPollie.set(gig.pollie_slug, existing);
  }
  return gigsByPollie;
}

function generateGigsSection(gigs: Gig[]): string {
  if (gigs.length === 0) return "";

  const gigItems = gigs
    .map((gig) => {
      const dateRange = gig.end_date
        ? `${formatISODate(gig.start_date)} – ${formatISODate(gig.end_date)}`
        : `${formatISODate(gig.start_date)} – present`;

      return `  <dt>${gig.role}</dt>
  <dd>
    <p>${gig.organisation} (${gig.category})</p>
    <p>${dateRange}</p>
    <p>Source: <a href="${gig.source}">${gig.source}</a></p>
  </dd>`;
    })
    .join("\n");

  return `

## Post-office roles

<dl>
${gigItems}
</dl>
`;
}

function generateContent(pollie: Pollie, gigs: Gig[]): string {
  const status = pollie.stillInOffice ? "In office" : pollie.reason;

  let leftOffice = "";
  if (!pollie.stillInOffice && pollie.ceasedDate) {
    leftOffice = `
  <dt>Left office</dt>
  <dd>${formatDate(pollie.ceasedDate)} (${timeAgo(pollie.ceasedDate)})</dd>`;
  }

  const gigsSection = generateGigsSection(gigs);

  return `<dl>
  <dt>Electorate</dt>
  <dd>${pollie.division}</dd>
  <dt>State</dt>
  <dd>${pollie.state}</dd>
  <dt>Party</dt>
  <dd>${pollie.party}</dd>
  <dt>Status</dt>
  <dd>${status}</dd>${leftOffice}
</dl>
${gigsSection}`;
}

interface PolliePath {
  params: {
    slug: string;
    name: string;
    division: string;
    state: string;
    party: string;
  };
  content: string;
}

declare const data: PolliePath[];

function transformData(
  pollies: Pollie[],
  gigsByPollie: Map<string, Gig[]>,
): PolliePath[] {
  return pollies.map((pollie) => {
    const pollieGigs = gigsByPollie.get(pollie.slug) || [];
    return {
      params: {
        slug: pollie.slug,
        name: pollie.name,
        division: pollie.division,
        state: pollie.state,
        party: pollie.party,
      },
      content: generateContent(pollie, pollieGigs),
    };
  });
}

export { data };

export default {
  async paths(): Promise<PolliePath[]> {
    const pollies = loadPollies();
    const allGigs = await loadGigs();
    const gigsByPollie = getGigsByPollie(allGigs);
    return transformData(pollies, gigsByPollie);
  },
};
