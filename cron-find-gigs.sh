#!/usr/bin/env bash
set -euo pipefail

# Resolved from the script's own location, so the same script works in the main
# checkout and in the dedicated cron worktree.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/find-gigs-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

log() { echo "$(date -Iseconds) $*" >> "$LOG_FILE"; }

# mise activates tool shims into PATH (node, npm, etc.)
eval "$(/home/ben/.local/bin/mise activate bash)"

cd "$PROJECT_DIR"

log "=== find-gigs started ==="

# Start detached at origin/main: never rebase, so a conflict can never wedge the
# job, and no local branch to collide with the one the main checkout has out.
git fetch origin >> "$LOG_FILE" 2>&1
git checkout -f --detach origin/main >> "$LOG_FILE" 2>&1
git reset --hard origin/main >> "$LOG_FILE" 2>&1

env -u CLAUDECODE /home/ben/.local/bin/claude \
  --dangerously-skip-permissions \
  -p "/find-gigs" \
  >> "$LOG_FILE" 2>&1 || true

# The skill is told not to commit, but if it does anyway, fold the commits back
# into the index so committed and uncommitted changes are handled identically.
git reset --soft origin/main >> "$LOG_FILE" 2>&1
git add data/gigs.json data/find-state.json

# If either file was modified, commit, push, and open a PR. find-state.json is
# included so the search throttle survives the next run's reset --hard.
if git diff --cached --quiet data/gigs.json data/find-state.json; then
  log "No new gigs found, nothing to commit"
  git reset --hard origin/main >> "$LOG_FILE" 2>&1
else
  BRANCH="find-gigs-$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$BRANCH"
  git show origin/main:data/gigs.json > /tmp/find-gigs-old.json
  python3 <<'PYEOF'
import json
from collections import Counter

with open("/tmp/find-gigs-old.json") as f:
    old = json.load(f)
with open("data/gigs.json") as f:
    new = json.load(f)

def key(g):
    return (g.get("pollie_slug"), g.get("role"), g.get("organisation"), g.get("start_date"))

old_keys = {key(g) for g in old}
added = [g for g in new if key(g) not in old_keys]
counts = Counter(g["pollie_slug"] for g in added)

slugs = sorted(counts.keys())
title_suffix = ", ".join(slugs)
if len(title_suffix) > 60:
    title_suffix = f"{len(counts)} pollies"
gig_word = "gig" if len(added) == 1 else "gigs"
if not slugs:
    title = "find-gigs: throttle update only"
else:
    title = f"Add {len(added)} {gig_word}: {title_suffix}"

body_lines = [f"Found {len(added)} new {gig_word}:", ""]
for slug, n in sorted(counts.items(), key=lambda x: (-x[1], x[0])):
    plural = "" if n == 1 else "s"
    body_lines.append(f"- {slug} ({n} new gig{plural})")

with open("/tmp/find-gigs-title", "w") as f:
    f.write(title)
with open("/tmp/find-gigs-body", "w") as f:
    f.write("\n".join(body_lines))
PYEOF
  PR_TITLE=$(cat /tmp/find-gigs-title)
  PR_BODY=$(cat /tmp/find-gigs-body)
  rm -f /tmp/find-gigs-old.json /tmp/find-gigs-title /tmp/find-gigs-body
  git commit -m "Add gigs found by cron job"
  git push -u origin "$BRANCH"
  gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    >> "$LOG_FILE" 2>&1
  git checkout -f --detach origin/main
  git branch -D "$BRANCH"
  log "PR created on branch ${BRANCH}, local branch deleted"
fi

log "=== find-gigs finished ==="
