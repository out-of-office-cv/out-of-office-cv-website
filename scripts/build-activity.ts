import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Gig } from "../src/types";

export interface CommitMeta {
  sha: string;
  author: string;
  date: string;
}

export type ActivityAction =
  | "added"
  | "verified"
  | "rejected"
  | "sources-edited"
  | "dates-edited"
  | "removed";

export interface ActivityEvent {
  sha: string;
  date: string;
  pollie_slug: string;
  role: string;
  organisation: string;
  action: ActivityAction;
  by: string;
  note?: string;
}

function key(g: Gig): string {
  return [g.pollie_slug, g.role, g.organisation].join("|");
}

function commitHasClaudeVerification(after: Gig[], before: Gig[]): boolean {
  const beforeMap = new Map(before.map((g) => [key(g), g]));
  for (const a of after) {
    const b = beforeMap.get(key(a));
    if (
      a.verification?.by === "claude" &&
      a.verification?.decision &&
      b?.verification?.decision !== a.verification.decision
    ) {
      return true;
    }
  }
  return false;
}

function summariseSourceChange(before: string[], after: string[]): string {
  const added = after.filter((s) => !before.includes(s)).length;
  const removed = before.filter((s) => !after.includes(s)).length;
  const parts: string[] = [];
  if (added) parts.push(`+${added}`);
  if (removed) parts.push(`-${removed}`);
  return parts.join(" ") || "reordered";
}

function summariseDateChange(before: Gig, after: Gig): string {
  const parts: string[] = [];
  if (before.start_date !== after.start_date) {
    parts.push(`start: ${before.start_date ?? "—"} → ${after.start_date ?? "—"}`);
  }
  if (before.end_date !== after.end_date) {
    parts.push(`end: ${before.end_date ?? "—"} → ${after.end_date ?? "—"}`);
  }
  return parts.join("; ");
}

export function classifyDiff(
  before: Gig[],
  after: Gig[],
  commit: CommitMeta,
): ActivityEvent[] {
  const beforeMap = new Map(before.map((g) => [key(g), g]));
  const afterMap = new Map(after.map((g) => [key(g), g]));
  const claudeCommit = commitHasClaudeVerification(after, before);
  const events: ActivityEvent[] = [];

  // Added or changed
  for (const [k, a] of afterMap) {
    const b = beforeMap.get(k);
    const meta = {
      sha: commit.sha,
      date: commit.date,
      pollie_slug: a.pollie_slug,
      role: a.role,
      organisation: a.organisation,
    };
    if (!b) {
      events.push({ ...meta, action: "added", by: commit.author });
      continue;
    }
    const beforeDecision = b.verification?.decision;
    const afterDecision = a.verification?.decision;
    if (beforeDecision !== afterDecision && afterDecision === "verified") {
      events.push({
        ...meta,
        action: "verified",
        by: a.verification!.by,
        note: a.verification!.note,
      });
    } else if (beforeDecision !== afterDecision && afterDecision === "rejected") {
      events.push({
        ...meta,
        action: "rejected",
        by: a.verification!.by,
        note: a.verification!.note,
      });
    }
    const sourcesChanged =
      JSON.stringify(b.sources) !== JSON.stringify(a.sources);
    if (sourcesChanged) {
      events.push({
        ...meta,
        action: "sources-edited",
        by: claudeCommit ? "claude" : commit.author,
        note: summariseSourceChange(b.sources, a.sources),
      });
    }
    const datesChanged =
      b.start_date !== a.start_date || b.end_date !== a.end_date;
    if (datesChanged) {
      events.push({
        ...meta,
        action: "dates-edited",
        by: claudeCommit ? "claude" : commit.author,
        note: summariseDateChange(b, a),
      });
    }
  }

  // Removed
  for (const [k, b] of beforeMap) {
    if (!afterMap.has(k)) {
      events.push({
        sha: commit.sha,
        date: commit.date,
        pollie_slug: b.pollie_slug,
        role: b.role,
        organisation: b.organisation,
        action: "removed",
        by: commit.author,
      });
    }
  }

  return events;
}

export function loadActivityEvents(repoRoot: string): ActivityEvent[] {
  const filePath = "data/gigs.json";
  const log = execSync(
    `git -C "${repoRoot}" log --reverse '--pretty=format:%H\x1f%an\x1f%aI' -- ${filePath}`,
    { encoding: "utf-8" },
  );
  const lines = log.trim().split("\n").filter(Boolean);
  const events: ActivityEvent[] = [];
  let prevContent = "[]";
  for (const line of lines) {
    const [sha, author, date] = line.split("\x1f");
    let after: Gig[] = [];
    try {
      const out = execSync(
        `git -C "${repoRoot}" show ${sha}:${filePath}`,
        { encoding: "utf-8" },
      );
      after = JSON.parse(out);
    } catch {
      after = [];
    }
    let before: Gig[] = [];
    try {
      before = JSON.parse(prevContent);
    } catch {
      before = [];
    }
    events.push(...classifyDiff(before, after, { sha, author, date }));
    prevContent = JSON.stringify(after);
  }
  return events;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const root = resolve(__dirname, "..");
  const events = loadActivityEvents(root);
  console.log(JSON.stringify(events, null, 2));
}
