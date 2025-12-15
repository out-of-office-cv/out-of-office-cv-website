import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

interface ApiParliamentarian {
  PHID: string;
  GivenName: string;
  FamilyName: string;
  PreferredName: string;
  PartyAbbrev: string;
  Electorate: string;
  SenateState: string;
  State: string;
  MPorSenator: string[];
  ServiceHistory_End: string;
  InCurrentParliament: string;
}

interface ApiResponse {
  "@odata.context": string;
  "@odata.nextLink"?: string;
  value: ApiParliamentarian[];
}

interface CsvPollie {
  phid: string;
  name: string;
  division: string;
  state: string;
  party: string;
  ceased_date: string;
  house: "reps" | "senate";
}

const API_BASE = "https://handbookapi.aph.gov.au/api/individuals";
const PAGE_SIZE = 100;

function buildApiUrl(since: number, skip: number): string {
  const select = [
    "PHID",
    "GivenName",
    "FamilyName",
    "PreferredName",
    "PartyAbbrev",
    "Electorate",
    "SenateState",
    "State",
    "MPorSenator",
    "ServiceHistory_End",
    "InCurrentParliament",
  ].join(",");

  const filter = [
    `InCurrentParliament eq 'False'`,
    `ServiceHistory_End ge '${since}-01-01'`,
  ].join(" and ");

  const params = new URLSearchParams({
    $select: select,
    $filter: filter,
    $top: String(PAGE_SIZE),
    $skip: String(skip),
    $orderby: "ServiceHistory_End desc",
  });

  return `${API_BASE}?${params}`;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildFullName(p: ApiParliamentarian): string {
  const preferredName = p.PreferredName?.replace(/[()]/g, "").trim();
  const firstName = preferredName || p.GivenName;
  const parts = [firstName, p.FamilyName].filter(Boolean).map(toTitleCase);
  return parts.join(" ");
}

function determineHouse(p: ApiParliamentarian): "reps" | "senate" {
  if (p.MPorSenator.includes("Senator")) return "senate";
  return "reps";
}

const stateAbbreviations: Record<string, string> = {
  "New South Wales": "NSW",
  Victoria: "Vic",
  Queensland: "Qld",
  "Western Australia": "WA",
  "South Australia": "SA",
  Tasmania: "Tas",
  "Australian Capital Territory": "ACT",
  "Northern Territory": "NT",
};

function abbreviateState(state: string): string {
  return stateAbbreviations[state] || state;
}

function formatCeasedDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function transformParliamentarian(p: ApiParliamentarian): CsvPollie {
  const house = determineHouse(p);
  const rawState = p.State || p.SenateState || "";
  return {
    phid: p.PHID,
    name: buildFullName(p),
    division: house === "reps" ? p.Electorate || "" : "",
    state: abbreviateState(rawState),
    party: p.PartyAbbrev || "",
    ceased_date: formatCeasedDate(p.ServiceHistory_End),
    house,
  };
}

async function fetchPage(url: string): Promise<ApiResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json() as Promise<ApiResponse>;
}

export async function fetchAllPollies(since: number): Promise<CsvPollie[]> {
  const pollies: CsvPollie[] = [];
  let skip = 0;
  let hasMore = true;

  console.log(`Fetching former parliamentarians from ${since} onwards...`);

  while (hasMore) {
    const url = buildApiUrl(since, skip);
    const data = await fetchPage(url);

    for (const p of data.value) {
      pollies.push(transformParliamentarian(p));
    }

    console.log(`  Fetched ${pollies.length} records...`);

    if (data.value.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      skip += PAGE_SIZE;
    }
  }

  return pollies;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(p: CsvPollie): string {
  return [p.phid, p.name, p.division, p.state, p.party, p.ceased_date, p.house]
    .map(escapeCSV)
    .join(",");
}

export function writeCsv(pollies: CsvPollie[], outputPath: string): void {
  const header = "phid,name,division,state,party,ceased_date,house";
  const rows = pollies.map(toCsvRow);
  const content = [header, ...rows].join("\n") + "\n";
  writeFileSync(outputPath, content, "utf-8");
}

interface ParsedArgs {
  since: number;
  dryRun: boolean;
  output: string;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let since = 1980;
  let dryRun = false;
  let output = resolve(rootDir, "data/pollies.csv");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since" && args[i + 1]) {
      since = parseInt(args[i + 1], 10) || 1980;
      i++;
    } else if (args[i] === "--dry-run") {
      dryRun = true;
    } else if (args[i] === "--output" && args[i + 1]) {
      output = resolve(args[i + 1]);
      i++;
    }
  }

  return { since, dryRun, output };
}

async function main() {
  const { since, dryRun, output } = parseArgs();

  console.log(`Fetching pollies who left parliament since ${since}...`);
  if (dryRun) {
    console.log("(dry run mode - will not write file)");
  }

  const pollies = await fetchAllPollies(since);

  console.log(`\nFetched ${pollies.length} former parliamentarians`);

  const repCount = pollies.filter((p) => p.house === "reps").length;
  const senateCount = pollies.filter((p) => p.house === "senate").length;
  console.log(`  Representatives: ${repCount}`);
  console.log(`  Senators: ${senateCount}`);

  if (dryRun) {
    console.log("\nFirst 5 records:");
    for (const p of pollies.slice(0, 5)) {
      console.log(`  ${p.name} (${p.phid}) - ${p.party}, ${p.state}`);
    }
    console.log("\nDry run complete (no file written)");
    return;
  }

  writeCsv(pollies, output);
  console.log(`\nWritten to ${output}`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
}
