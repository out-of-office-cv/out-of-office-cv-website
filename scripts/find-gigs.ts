import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { parseDate } from "../.vitepress/utils.js";
import { loadPollies } from "../.vitepress/loaders.js";
import type { Pollie, Gig, GigCategory } from "../.vitepress/types.js";
import { GIG_CATEGORIES } from "../.vitepress/types.js";
import { GigsArraySchema } from "../data/gigs-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

export { GIG_CATEGORIES };

export interface FoundGig {
  role: string;
  organisation: string;
  category: GigCategory;
  sources: string[];
  start_date?: string;
  end_date?: string;
}

export type Strategy = "recent-no-gigs" | "recent-few-gigs" | "random";

function sortByRecency(pollies: Pollie[]): Pollie[] {
  return [...pollies].sort((a, b) => {
    const dateA = parseDate(a.ceasedDate);
    const dateB = parseDate(b.ceasedDate);
    if (!dateA || !dateB) return 0;
    return dateB.getTime() - dateA.getTime();
  });
}

export function listCandidates(
  pollies: Pollie[],
  gigs: Gig[],
  strategy: Strategy,
  limit?: number,
): Pollie[] {
  const gigSlugs = new Set(gigs.map((g) => g.pollie_slug));
  const gigCounts = new Map<string, number>();
  for (const gig of gigs) {
    gigCounts.set(gig.pollie_slug, (gigCounts.get(gig.pollie_slug) || 0) + 1);
  }

  const formerPollies = pollies.filter((p) => !p.stillInOffice);

  let candidates: Pollie[];
  if (strategy === "recent-no-gigs") {
    candidates = sortByRecency(
      formerPollies.filter((p) => !gigSlugs.has(p.slug)),
    );
  } else if (strategy === "recent-few-gigs") {
    candidates = sortByRecency(
      formerPollies.filter((p) => (gigCounts.get(p.slug) || 0) < 3),
    );
  } else {
    candidates = formerPollies.filter((p) => !gigSlugs.has(p.slug));
  }

  return limit ? candidates.slice(0, limit) : candidates;
}

export function selectPollie(
  pollies: Pollie[],
  gigs: Gig[],
  strategy: Strategy,
  explicitSlug?: string,
): Pollie | null {
  if (explicitSlug) {
    return pollies.find((p) => p.slug === explicitSlug) || null;
  }

  const candidates = listCandidates(pollies, gigs, strategy, 1);
  if (candidates.length === 0) return null;

  if (strategy === "random") {
    const all = listCandidates(pollies, gigs, strategy);
    return all[Math.floor(Math.random() * all.length)] || null;
  }

  return candidates[0];
}

function getSearchName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * 0.00000005 + outputTokens * 0.0000004;
}

export function buildPrompt(pollie: Pollie): string {
  const ceasedDateFormatted = pollie.ceasedDate
    ? parseDate(pollie.ceasedDate)?.toLocaleDateString("en-AU", {
        month: "long",
        year: "numeric",
      })
    : "unknown";

  const searchName = getSearchName(pollie.name);

  return `Search the web for information about ${searchName}, a former Australian politician.

Background:
- Party: ${pollie.party}
- State: ${pollie.state}
- ${pollie.house === "senate" ? "Senator" : `Member for ${pollie.division}`}
- Left parliament: ${ceasedDateFormatted}
- Reason for leaving: ${pollie.reason || "unknown"}

Find ALL roles, positions, or jobs they have taken since leaving parliament. Return every role you can find with verifiable sources. This includes:
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
- Return ALL roles found, not just the most prominent one
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
            type: ["string", "null"] as const,
            description: "Start date in YYYY-MM-DD format, or null if unknown",
          },
          end_date: {
            type: ["string", "null"] as const,
            description:
              "End date in YYYY-MM-DD format, or null if ongoing/unknown",
          },
        },
        required: [
          "role",
          "organisation",
          "category",
          "sources",
          "start_date",
          "end_date",
        ] as const,
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

  if (response.usage) {
    const { input_tokens, output_tokens } = response.usage;
    const cost = estimateCost(input_tokens, output_tokens);
    console.log(
      `  Tokens: ${input_tokens} in, ${output_tokens} out ($${cost.toFixed(4)})`,
    );
  }

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

export function readGigsJson(gigsPath?: string): Gig[] {
  const path = gigsPath ?? resolve(rootDir, "data/gigs.json");
  const content = readFileSync(path, "utf-8");
  return GigsArraySchema.parse(JSON.parse(content));
}

export function writeGigsJson(gigs: Gig[], gigsPath?: string): void {
  const path = gigsPath ?? resolve(rootDir, "data/gigs.json");
  GigsArraySchema.parse(gigs);
  writeFileSync(path, JSON.stringify(gigs, null, 2) + "\n", "utf-8");
}

export function appendGigsToJson(newGigs: Gig[], gigsPath?: string): void {
  const path = gigsPath ?? resolve(rootDir, "data/gigs.json");
  const existingGigs = readGigsJson(path);
  const allGigs = [...existingGigs, ...newGigs];
  writeGigsJson(allGigs, path);
}

interface ParsedArgs {
  strategy: Strategy;
  pollie?: string;
  dryRun: boolean;
  listCandidates: boolean;
  limit: number;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let strategy: Strategy = "recent-no-gigs";
  let pollie: string | undefined;
  let dryRun = false;
  let listCandidates = false;
  let limit = 10;

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
    } else if (args[i] === "--list-candidates" || args[i] === "-l") {
      listCandidates = true;
    } else if (args[i] === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1], 10) || 10;
      i++;
    }
  }

  return { strategy, pollie, dryRun, listCandidates, limit };
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

function formatCeasedDate(pollie: Pollie): string {
  const date = parseDate(pollie.ceasedDate);
  return date
    ? date.toLocaleDateString("en-AU", { month: "short", year: "numeric" })
    : "unknown";
}

async function main() {
  const {
    strategy,
    pollie: explicitPollie,
    dryRun,
    listCandidates: showCandidates,
    limit,
  } = parseArgs();

  const pollies = loadPollies(resolve(rootDir, "data"));
  const existingGigs = readGigsJson();

  if (showCandidates) {
    const candidates = listCandidates(pollies, existingGigs, strategy, limit);
    console.log(`Candidates for gig search (strategy: ${strategy}):\n`);
    for (const p of candidates) {
      console.log(
        `  ${p.slug.padEnd(30)} ${p.party.padEnd(10)} ${formatCeasedDate(p)}`,
      );
    }
    console.log(`\nShowing ${candidates.length} candidates`);
    return;
  }

  if (dryRun) {
    console.log(
      "Running in dry-run mode (using mock data, not writing to file)",
    );
  }

  console.log("Loading pollies...");
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

  const newGigs: Gig[] = foundGigs.map((g) => ({
    ...g,
    pollie_slug: selectedPollie.slug,
  }));

  console.log("Appending gigs to data/gigs.json...");
  appendGigsToJson(newGigs);

  console.log("Done! New gigs added (unverified)");
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
