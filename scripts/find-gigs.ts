import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import OpenAI from "openai";
import { parseCSV, slugify, parseDate } from "../.vitepress/utils.js";
import type { Pollie, Gig, GigCategory } from "../.vitepress/types.js";
import { gigs as existingGigs } from "../data/gigs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

export const GIG_CATEGORIES: GigCategory[] = [
  "Natural Resources (Mining, Oil & Gas)",
  "Energy (Renewables & Traditional)",
  "Agriculture, Forestry & Fisheries",
  "Environment, Climate & Sustainability",
  "Health, Medical & Aged Care",
  "Pharmaceutical & Biotechnology",
  "Education, Academia & Research",
  "Government, Public Administration & Civil Service",
  "Diplomacy & International Relations",
  "Politics, Campaigning & Party Operations",
  "Defence & Military and Security",
  "Nonprofit, NGO and Charity",
  "Legal & Judicial",
  "Professional Services & Management Consulting",
  "Financial Services and Banking",
  "Technology (Software, IT & Digital Services)",
  "Telecommunications & Network Infrastructure",
  "Media, Communications & Public Relations",
  "Gambling, Gaming and Racing",
  "Retail, Hospitality & Tourism",
  "Arts, Culture & Sport",
  "Science, Engineering & Technical Professions",
  "Retired",
];

export interface FoundGig {
  role: string;
  organisation: string;
  category: GigCategory;
  sources: string[];
  start_date?: string;
  end_date?: string;
}

export function loadPollies(dataDir?: string): Pollie[] {
  const baseDir = dataDir ?? resolve(rootDir, "data");
  const pollies: Pollie[] = [];

  for (const { file, house } of [
    { file: "representatives.csv", house: "reps" as const },
    { file: "senators.csv", house: "senate" as const },
  ]) {
    const csvPath = resolve(baseDir, file);
    if (!existsSync(csvPath)) continue;

    const content = readFileSync(csvPath, "utf-8");
    const rows = parseCSV(content);

    for (const row of rows.slice(1)) {
      if (!row[2]) continue;

      const ceasedDate = row[7] || "";
      const stillInOffice = !ceasedDate;

      pollies.push({
        slug: slugify(row[2]),
        name: row[2],
        division: row[3] || "",
        state: row[4] || "",
        party: row[9] || "",
        ceasedDate,
        reason: row[8] || "",
        stillInOffice,
        house,
      });
    }
  }

  const pollieMap = new Map<string, Pollie>();
  for (const pollie of pollies) {
    const existing = pollieMap.get(pollie.slug);
    if (!existing) {
      pollieMap.set(pollie.slug, pollie);
    } else {
      const existingDate = parseDate(existing.ceasedDate);
      const newDate = parseDate(pollie.ceasedDate);

      if (pollie.stillInOffice && !existing.stillInOffice) {
        pollieMap.set(pollie.slug, pollie);
      } else if (
        !existing.stillInOffice &&
        !pollie.stillInOffice &&
        newDate &&
        existingDate &&
        newDate > existingDate
      ) {
        pollieMap.set(pollie.slug, pollie);
      }
    }
  }

  return Array.from(pollieMap.values());
}

export type Strategy = "recent-no-gigs" | "recent-few-gigs" | "random";

export function selectPollie(
  pollies: Pollie[],
  gigs: Gig[],
  strategy: Strategy,
  explicitSlug?: string,
): Pollie | null {
  if (explicitSlug) {
    return pollies.find((p) => p.slug === explicitSlug) || null;
  }

  const gigSlugs = new Set(gigs.map((g) => g.pollie_slug));
  const formerPollies = pollies.filter((p) => !p.stillInOffice);

  if (strategy === "recent-no-gigs") {
    const withoutGigs = formerPollies.filter((p) => !gigSlugs.has(p.slug));
    withoutGigs.sort((a, b) => {
      const dateA = parseDate(a.ceasedDate);
      const dateB = parseDate(b.ceasedDate);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });
    return withoutGigs[0] || null;
  }

  if (strategy === "recent-few-gigs") {
    const gigCounts = new Map<string, number>();
    for (const gig of gigs) {
      gigCounts.set(gig.pollie_slug, (gigCounts.get(gig.pollie_slug) || 0) + 1);
    }
    const fewGigs = formerPollies.filter(
      (p) => (gigCounts.get(p.slug) || 0) < 3,
    );
    fewGigs.sort((a, b) => {
      const dateA = parseDate(a.ceasedDate);
      const dateB = parseDate(b.ceasedDate);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });
    return fewGigs[0] || null;
  }

  if (strategy === "random") {
    const withoutGigs = formerPollies.filter((p) => !gigSlugs.has(p.slug));
    if (withoutGigs.length === 0) return null;
    return withoutGigs[Math.floor(Math.random() * withoutGigs.length)];
  }

  return null;
}

export function buildPrompt(pollie: Pollie): string {
  const ceasedDateFormatted = pollie.ceasedDate
    ? parseDate(pollie.ceasedDate)?.toLocaleDateString("en-AU", {
        month: "long",
        year: "numeric",
      })
    : "unknown";

  return `Search the web for information about ${pollie.name}, a former Australian politician.

Background:
- Party: ${pollie.party}
- State: ${pollie.state}
- ${pollie.house === "senate" ? "Senator" : `Member for ${pollie.division}`}
- Left parliament: ${ceasedDateFormatted}
- Reason for leaving: ${pollie.reason || "unknown"}

Find any roles, positions, or jobs they have taken since leaving parliament. This includes:
- Board positions (director, chair, advisory board member)
- Consulting or lobbying work
- Academic positions (professor, fellow, visiting scholar)
- Corporate roles (CEO, executive, advisor)
- Nonprofit or charity work
- Government appointments (ambassador, commissioner)
- Media roles (columnist, commentator, presenter)

For each role found, provide:
1. The role/title
2. The organisation
3. A category from this list: ${GIG_CATEGORIES.join(", ")}
4. Source URLs that verify this information (news articles, company pages, LinkedIn, official announcements)
5. Start date if known (YYYY-MM-DD format)
6. End date if known and the role has ended (YYYY-MM-DD format)

Important:
- Only include roles taken AFTER leaving parliament
- Each role MUST have at least one verifiable source URL
- Do not include speculation or unverified claims
- If no post-parliamentary roles can be found with sources, return an empty array`;
}

export const gigSchema = {
  type: "object" as const,
  properties: {
    gigs: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          role: {
            type: "string" as const,
            description: "The job title or position",
          },
          organisation: {
            type: "string" as const,
            description: "The company or organisation",
          },
          category: {
            type: "string" as const,
            enum: GIG_CATEGORIES,
            description: "The category of the role",
          },
          sources: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "URLs that verify this role",
          },
          start_date: {
            type: "string" as const,
            description: "Start date in YYYY-MM-DD format, if known",
          },
          end_date: {
            type: "string" as const,
            description: "End date in YYYY-MM-DD format, if the role has ended",
          },
        },
        required: ["role", "organisation", "category", "sources"] as const,
        additionalProperties: false,
      },
    },
  },
  required: ["gigs"] as const,
  additionalProperties: false,
};

export async function findGigsFromApi(pollie: Pollie): Promise<FoundGig[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const client = new OpenAI({ apiKey });
  const prompt = buildPrompt(pollie);

  console.log(`Searching for gigs for ${pollie.name}...`);

  const response = await client.responses.create({
    model: "gpt-5-nano",
    input: prompt,
    tools: [{ type: "web_search" }],
    text: {
      format: {
        type: "json_schema",
        name: "gig_results",
        schema: gigSchema,
        strict: true,
      },
    },
  });

  const outputText = response.output_text;
  if (!outputText) {
    console.log("No response from API");
    return [];
  }

  try {
    const parsed = JSON.parse(outputText) as { gigs: FoundGig[] };
    return parsed.gigs || [];
  } catch {
    console.error("Failed to parse API response:", outputText);
    return [];
  }
}

export function formatGig(gig: Gig): string {
  const lines = [
    "  {",
    `    role: ${JSON.stringify(gig.role)},`,
    `    organisation: ${JSON.stringify(gig.organisation)},`,
    `    category: ${JSON.stringify(gig.category)},`,
    `    sources: [`,
    ...gig.sources.map((s) => `      ${JSON.stringify(s)},`),
    "    ],",
    `    pollie_slug: ${JSON.stringify(gig.pollie_slug)},`,
  ];

  if (gig.start_date) {
    lines.push(`    start_date: ${JSON.stringify(gig.start_date)},`);
  }
  if (gig.end_date) {
    lines.push(`    end_date: ${JSON.stringify(gig.end_date)},`);
  }

  lines.push("  },");
  return lines.join("\n");
}

export function formatGigsFile(
  existingContent: string,
  newGigs: Gig[],
): string {
  const closingBracket = existingContent.lastIndexOf("];");
  if (closingBracket === -1) {
    throw new Error("Could not find closing bracket in gigs.ts");
  }

  const formattedGigs = newGigs.map(formatGig).join("\n");
  return existingContent.slice(0, closingBracket) + formattedGigs + "\n];\n";
}

export function appendGigsToFile(newGigs: Gig[], gigsPath?: string): void {
  const path = gigsPath ?? resolve(rootDir, "data/gigs.ts");
  const content = readFileSync(path, "utf-8");
  const newContent = formatGigsFile(content, newGigs);
  writeFileSync(path, newContent, "utf-8");
}

export function validateTypeScript(cwd?: string): boolean {
  try {
    execSync("npx tsc --noEmit", { cwd: cwd ?? rootDir, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function parseArgs(): { strategy: Strategy; pollie?: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let strategy: Strategy = "recent-no-gigs";
  let pollie: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--strategy" && args[i + 1]) {
      const s = args[i + 1];
      if (s === "recent-no-gigs" || s === "recent-few-gigs" || s === "random") {
        strategy = s;
      }
      i++;
    } else if (args[i] === "--pollie" && args[i + 1]) {
      pollie = args[i + 1];
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    }
  }

  return { strategy, pollie, dryRun };
}

function getMockGigs(): FoundGig[] {
  return [
    {
      role: "Board Member",
      organisation: "Example Corporation",
      category: "Professional Services & Management Consulting",
      sources: ["https://example.com/announcement"],
      start_date: "2024-01-15",
    },
    {
      role: "Advisory Council Member",
      organisation: "Test University",
      category: "Education, Academia & Research",
      sources: [
        "https://example.edu/news/appointment",
        "https://example.com/secondary-source",
      ],
      start_date: "2023-06-01",
      end_date: "2024-12-31",
    },
  ];
}

async function main() {
  const { strategy, pollie: explicitPollie, dryRun } = parseArgs();

  if (dryRun) {
    console.log(
      "Running in dry-run mode (using mock data, not writing to file)",
    );
  }

  console.log("Loading pollies...");
  const pollies = loadPollies();
  console.log(`Loaded ${pollies.length} pollies`);

  console.log(`Using strategy: ${strategy}`);
  const selectedPollie = selectPollie(
    pollies,
    existingGigs,
    strategy,
    explicitPollie,
  );

  if (!selectedPollie) {
    console.error("No suitable pollie found");
    process.exit(1);
  }

  console.log(`Selected: ${selectedPollie.name} (${selectedPollie.slug})`);
  console.log(
    `  ${selectedPollie.party}, ${selectedPollie.state}, left ${selectedPollie.ceasedDate}`,
  );

  const foundGigs = dryRun
    ? getMockGigs()
    : await findGigsFromApi(selectedPollie);

  if (foundGigs.length === 0) {
    console.log("No gigs found");
    process.exit(0);
  }

  console.log(`Found ${foundGigs.length} gigs:`);
  for (const gig of foundGigs) {
    console.log(`  - ${gig.role} at ${gig.organisation}`);
  }

  if (dryRun) {
    console.log("Dry run complete (no changes written)");
    return;
  }

  const gigsPath = resolve(rootDir, "data/gigs.ts");
  const originalContent = readFileSync(gigsPath, "utf-8");

  const newGigs: Gig[] = foundGigs.map((g) => ({
    ...g,
    pollie_slug: selectedPollie.slug,
  }));

  console.log("Appending gigs to data/gigs.ts...");
  appendGigsToFile(newGigs);

  console.log("Validating TypeScript...");
  if (!validateTypeScript()) {
    console.error("TypeScript validation failed, reverting changes");
    writeFileSync(gigsPath, originalContent, "utf-8");
    process.exit(1);
  }

  console.log("Done! New gigs added (unverified)");
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
