#!/usr/bin/env bash
set -euo pipefail

# Resolved from the script's own location, so the same script works in the main
# checkout and in the dedicated cron worktree.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/verify-gigs-$(date +%Y-%m-%d).log"

JOB_NAME=verify-gigs

mkdir -p "$LOG_DIR"

# shellcheck source=cron-lib.sh
source "${PROJECT_DIR}/cron-lib.sh"

eval "$(/home/ben/.local/bin/mise activate bash)"

cd "$PROJECT_DIR"

take_lock || exit 0

log "=== verify-gigs started ==="

# Start detached at origin/main: never rebase, so a conflict can never wedge the
# job, and no local branch to collide with the one the main checkout has out.
git fetch origin >> "$LOG_FILE" 2>&1
git checkout -f --detach origin/main >> "$LOG_FILE" 2>&1
git reset --hard origin/main >> "$LOG_FILE" 2>&1

# The state file is untracked, so the checkout above can only remove it, never
# restore it. Seed it from the mirror when this worktree has none.
load_state data/verify-state.json

run_agent "verify-gigs"

mirror_state data/verify-state.json

# The skill is told not to commit, but if it does anyway, fold the commits back
# into the index so committed and uncommitted changes are handled identically.
git reset --soft origin/main >> "$LOG_FILE" 2>&1
git add data/gigs.json
git reset -q origin/main -- data/verify-state.json

if git diff --cached --quiet data/gigs.json; then
  log "No verification changes, nothing to commit"
  git reset --hard origin/main >> "$LOG_FILE" 2>&1
else
  BRANCH="verify-gigs-$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$BRANCH"
  git show HEAD:data/gigs.json > /tmp/verify-gigs-old.json
  git add data/gigs.json
git reset -q origin/main -- data/verify-state.json
  python3 <<'PYEOF'
import json
from collections import defaultdict

with open("/tmp/verify-gigs-old.json") as f:
    old = json.load(f)
with open("data/gigs.json") as f:
    new = json.load(f)

def key(g):
    return (g.get("pollie_slug"), g.get("role"), g.get("organisation"), g.get("start_date"))

old_by_key = {key(g): g for g in old}

verified = defaultdict(int)
rejected = defaultdict(list)
edited = defaultdict(int)

for g in new:
    k = key(g)
    o = old_by_key.get(k)
    if not o:
        continue
    new_v = g.get("verification")
    old_v = o.get("verification")
    if new_v and not old_v:
        if new_v["decision"] == "verified":
            verified[g["pollie_slug"]] += 1
        elif new_v["decision"] == "rejected":
            rejected[g["pollie_slug"]].append((g["role"], g["organisation"], new_v.get("note", "")))
    elif not new_v:
        if g.get("sources") != o.get("sources") or g.get("start_date") != o.get("start_date") or g.get("end_date") != o.get("end_date"):
            edited[g["pollie_slug"]] += 1

total_verified = sum(verified.values())
total_rejected = sum(len(v) for v in rejected.values())
total_edited = sum(edited.values())

slugs = sorted(set(verified) | set(rejected) | set(edited))
title_suffix = ", ".join(slugs[:3])
if len(slugs) > 3:
    title_suffix += f" and {len(slugs) - 3} more"
if not slugs:
    title = "verify-gigs: throttle update only"
else:
    title = f"Verify {total_verified}, reject {total_rejected}, edit {total_edited}: {title_suffix}"

body = [
    f"**Verified**: {total_verified}",
    f"**Rejected**: {total_rejected}",
    f"**Edits on still-unverified**: {total_edited}",
    "",
]
for slug in slugs:
    parts = []
    if verified[slug]:
        parts.append(f"verified={verified[slug]}")
    if rejected[slug]:
        parts.append(f"rejected={len(rejected[slug])}")
    if edited[slug]:
        parts.append(f"edits={edited[slug]}")
    body.append(f"- {slug}: {', '.join(parts)}")
    for role, org, note in rejected[slug]:
        body.append(f"    - rejected: {role} @ {org} — {note}")

with open("/tmp/verify-gigs-title", "w") as f:
    f.write(title)
with open("/tmp/verify-gigs-body", "w") as f:
    f.write("\n".join(body))
PYEOF
  PR_TITLE=$(cat /tmp/verify-gigs-title)
  PR_BODY=$(cat /tmp/verify-gigs-body)
  if [[ $AGENT_EXIT -ne 0 ]]; then
    PR_BODY="**Partial run**: the agent exited ${AGENT_EXIT}, so this is
whatever it had finished before it stopped.

${PR_BODY}"
  fi
  rm -f /tmp/verify-gigs-old.json /tmp/verify-gigs-title /tmp/verify-gigs-body
  git commit -m "Verify gigs via cron job"
  git push -u origin "$BRANCH"
  gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    >> "$LOG_FILE" 2>&1
  git checkout -f --detach origin/main
  git branch -D "$BRANCH"
  log "PR created on branch ${BRANCH}, local branch deleted"
fi

log "=== verify-gigs finished ==="
