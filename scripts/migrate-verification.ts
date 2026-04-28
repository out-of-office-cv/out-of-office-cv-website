import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface OldGig {
  verified_by?: string;
  verification?: { decision: "verified" | "rejected"; by: string; note?: string };
  [key: string]: unknown;
}

export function migrateGig(gig: OldGig): Record<string, unknown> {
  const { verified_by, ...rest } = gig;
  if (rest.verification) return rest;
  if (verified_by) {
    return { ...rest, verification: { decision: "verified", by: verified_by } };
  }
  return rest;
}

function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = resolve(__dirname, "..", "data", "gigs.json");
  const content = readFileSync(path, "utf-8");
  const gigs: OldGig[] = JSON.parse(content);
  const migrated = gigs.map(migrateGig);
  writeFileSync(path, JSON.stringify(migrated, null, 2) + "\n");
  console.log(`Migrated ${migrated.length} gigs`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
