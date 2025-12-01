import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

interface Pollie {
  slug: string;
  name: string;
  division: string;
  state: string;
  party: string;
  ceasedDate: string;
  reason: string;
  stillInOffice: boolean;
}

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

function generateMarkdown(pollie: Pollie): string {
  const status = pollie.stillInOffice ? "In office" : pollie.reason;

  let leftOffice = "";
  if (!pollie.stillInOffice && pollie.ceasedDate) {
    leftOffice = `
  <dt>Left office</dt>
  <dd>${formatDate(pollie.ceasedDate)} (${timeAgo(pollie.ceasedDate)})</dd>`;
  }

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
`;
}

function generatePollies(rootDir: string): number {
  const csvPath = resolve(rootDir, "data/representatives.csv");
  const polliesDir = resolve(rootDir, "pollies");

  if (!existsSync(csvPath)) {
    return 0;
  }

  rmSync(polliesDir, { recursive: true, force: true });
  mkdirSync(polliesDir, { recursive: true });

  const pollies = loadPollies(csvPath);

  for (const pollie of pollies) {
    const markdown = generateMarkdown(pollie);
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
    buildStart() {
      const count = generatePollies(rootDir);
      console.log(`Generated ${count} pollie pages`);
    },
    configureServer(server) {
      const csvPath = resolve(rootDir, "data/representatives.csv");
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;

      server.watcher.add(csvPath);
      server.watcher.on("change", (path) => {
        if (path === csvPath) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            const count = generatePollies(rootDir);
            console.log(`CSV changed, regenerated ${count} pollie pages`);
            server.restart();
          }, 100);
        }
      });
    },
  };
}
