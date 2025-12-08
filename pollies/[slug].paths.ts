import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pollie, Gig, House } from "../.vitepress/types";
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

  const dataRows: { row: string[]; house: House }[] = [];

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
    { row: string[]; ceasedDate: Date | null; house: House }
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

  return Array.from(pollieMap.values()).map(({ row, house }) => ({
    slug: slugify(row[2]),
    name: row[2],
    division: row[3] || "",
    state: row[4] || "",
    party: row[9] || "",
    ceasedDate: row[7] || "",
    reason: row[8] || "",
    stillInOffice: row[8] === "still_in_office",
    house,
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
      let dateRange: string;
      if (gig.start_date) {
        dateRange = gig.end_date
          ? `${formatISODate(gig.start_date)} – ${formatISODate(gig.end_date)}`
          : `${formatISODate(gig.start_date)} – present`;
      } else {
        dateRange = gig.end_date
          ? `until ${formatISODate(gig.end_date)}`
          : "dates unknown";
      }

      const sourcesHtml =
        gig.sources.length === 1
          ? `<a href="${gig.sources[0]}">${gig.sources[0]}</a>`
          : gig.sources
              .map((s, i) => `<a href="${s}">[${i + 1}]</a>`)
              .join(" ");

      return `  <dt>${gig.role}</dt>
  <dd>
    <p>${gig.organisation} (${gig.category})</p>
    <p>${dateRange}</p>
    <p>Sources: ${sourcesHtml}</p>
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
  return generateGigsSection(gigs);
}

interface PolliePath {
  params: {
    slug: string;
    name: string;
    division: string;
    state: string;
    party: string;
    house: House;
    stillInOffice: boolean;
    leftOfficeDate: string;
    leftOfficeAgo: string;
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
        house: pollie.house,
        stillInOffice: pollie.stillInOffice,
        leftOfficeDate: pollie.ceasedDate ? formatDate(pollie.ceasedDate) : "",
        leftOfficeAgo: pollie.ceasedDate ? timeAgo(pollie.ceasedDate) : "",
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
