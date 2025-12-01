import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";
import type { Pollie, Gig } from "./types";

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

function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split(".");
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function formatDate(dateStr: string): string {
  const date = parseDate(dateStr);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatISODate(isoDateStr: string): string {
  const date = new Date(isoDateStr);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  const date = parseDate(dateStr);
  const now = new Date();
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (months < 12) {
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function loadPollies(csvPath: string): Pollie[] {
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);
  const [, ...dataRows] = rows;

  return dataRows
    .filter((row) => row[2])
    .map((row) => ({
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

async function loadGigs(rootDir: string): Promise<Gig[]> {
  const gigsPath = resolve(rootDir, "data/gigs.ts");
  if (!existsSync(gigsPath)) {
    return [];
  }
  const module = await import(gigsPath);
  return module.gigs || [];
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
    <p><a href="${gig.verified_by}">Source</a></p>
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

function generateMarkdown(pollie: Pollie, gigs: Gig[]): string {
  const status = pollie.stillInOffice ? "In office" : pollie.reason;

  let leftOffice = "";
  if (!pollie.stillInOffice && pollie.ceasedDate) {
    leftOffice = `
  <dt>Left office</dt>
  <dd>${formatDate(pollie.ceasedDate)} (${timeAgo(pollie.ceasedDate)})</dd>`;
  }

  const gigsSection = generateGigsSection(gigs);

  return `---
title: "${pollie.name}"
---

# ${pollie.name}

<dl>
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

async function generatePollies(rootDir: string): Promise<number> {
  const csvPath = resolve(rootDir, "data/representatives.csv");
  const polliesDir = resolve(rootDir, "pollies");

  if (!existsSync(csvPath)) {
    return 0;
  }

  rmSync(polliesDir, { recursive: true, force: true });
  mkdirSync(polliesDir, { recursive: true });

  const pollies = loadPollies(csvPath);
  const allGigs = await loadGigs(rootDir);

  const gigsByPollie = new Map<string, Gig[]>();
  for (const gig of allGigs) {
    const existing = gigsByPollie.get(gig.pollie_slug) || [];
    existing.push(gig);
    gigsByPollie.set(gig.pollie_slug, existing);
  }

  for (const pollie of pollies) {
    const pollieGigs = gigsByPollie.get(pollie.slug) || [];
    const markdown = generateMarkdown(pollie, pollieGigs);
    writeFileSync(resolve(polliesDir, `${pollie.slug}.md`), markdown);
  }

  const indexContent = `# Pollies

${pollies.map((p) => `- [${p.name}](/pollies/${p.slug}) — ${p.division}, ${p.state} (${p.party})`).join("\n")}
`;
  writeFileSync(resolve(polliesDir, "index.md"), indexContent);

  return pollies.length;
}

export function generatePolliesPlugin(): Plugin {
  let rootDir: string;

  return {
    name: "generate-pollies",
    configResolved(config) {
      rootDir = config.root;
    },
    async buildStart() {
      const count = await generatePollies(rootDir);
      console.log(`Generated ${count} pollie pages`);
    },
    configureServer(server) {
      const csvPath = resolve(rootDir, "data/representatives.csv");
      const gigsPath = resolve(rootDir, "data/gigs.ts");
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      server.watcher.add(csvPath);
      server.watcher.add(gigsPath);
      server.watcher.on("change", async (path) => {
        if (path === csvPath || path === gigsPath) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            const count = await generatePollies(rootDir);
            console.log(`Data changed, regenerated ${count} pollie pages`);
            server.restart();
          }, 100);
        }
      });
    },
  };
}
