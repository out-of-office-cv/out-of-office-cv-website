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

function key3(g: Gig): string {
  return [g.pollie_slug, g.role, g.organisation].join("|");
}

function key4(g: Gig): string {
  return [g.pollie_slug, g.role, g.organisation, g.start_date ?? "null"].join(
    "|",
  );
}

function commitHasClaudeVerification(after: Gig[], before: Gig[]): boolean {
  const beforeMap = new Map(before.map((g) => [key4(g), g]));
  for (const a of after) {
    const b = beforeMap.get(key4(a));
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

function emitChangeEvents(
  b: Gig,
  a: Gig,
  commit: CommitMeta,
  claudeCommit: boolean,
  events: ActivityEvent[],
): void {
  const meta = {
    sha: commit.sha,
    date: commit.date,
    pollie_slug: a.pollie_slug,
    role: a.role,
    organisation: a.organisation,
  };
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

export function classifyDiff(
  before: Gig[],
  after: Gig[],
  commit: CommitMeta,
): ActivityEvent[] {
  // Match using the 4-part key (pollie, role, org, start_date) to keep
  // distinct-tenure entries separate (e.g. someone holding the same role
  // twice). When start_date changes on the same gig, fall back to a 3-part
  // match — but only when exactly one unmatched candidate remains, so we
  // never alias real duplicates.
  const beforeBy4 = new Map(before.map((g) => [key4(g), g]));
  const afterBy4 = new Map(after.map((g) => [key4(g), g]));
  const claudeCommit = commitHasClaudeVerification(after, before);
  const events: ActivityEvent[] = [];
  const consumed = new Set<string>();

  // Phase 1: exact 4-part matches.
  for (const [k4, a] of afterBy4) {
    const b = beforeBy4.get(k4);
    if (b) {
      consumed.add(k4);
      emitChangeEvents(b, a, commit, claudeCommit, events);
    }
  }

  // Phase 2: for unmatched after gigs, try a 3-part fallback to detect
  // start_date changes on the same logical gig.
  const remainingBefore3 = new Map<string, Gig[]>();
  for (const [k4, b] of beforeBy4) {
    if (consumed.has(k4)) continue;
    const k3 = key3(b);
    const arr = remainingBefore3.get(k3) ?? [];
    arr.push(b);
    remainingBefore3.set(k3, arr);
  }

  for (const [k4, a] of afterBy4) {
    if (consumed.has(k4)) continue;
    const k3 = key3(a);
    const candidates = remainingBefore3.get(k3) ?? [];
    if (candidates.length === 1) {
      const b = candidates[0];
      consumed.add(key4(b));
      remainingBefore3.set(k3, []);
      emitChangeEvents(b, a, commit, claudeCommit, events);
    } else {
      events.push({
        sha: commit.sha,
        date: commit.date,
        pollie_slug: a.pollie_slug,
        role: a.role,
        organisation: a.organisation,
        action: "added",
        by: commit.author,
      });
    }
  }

  // Phase 3: anything in before not consumed is removed.
  for (const [k4, b] of beforeBy4) {
    if (consumed.has(k4)) continue;
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
