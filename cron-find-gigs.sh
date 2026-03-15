#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/ben/projects/out-of-office-cv-website"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/find-gigs-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

log() { echo "$(date -Iseconds) $*" >> "$LOG_FILE"; }

# mise activates tool shims into PATH (node, npm, etc.)
eval "$(/home/ben/.local/bin/mise activate bash)"

cd "$PROJECT_DIR"

log "=== find-gigs started ==="

git checkout main >> "$LOG_FILE" 2>&1
git reset --hard >> "$LOG_FILE" 2>&1
git pull --rebase origin main >> "$LOG_FILE" 2>&1

env -u CLAUDECODE /home/ben/.local/bin/claude \
  --dangerously-skip-permissions \
  -p "/find-gigs" \
  >> "$LOG_FILE" 2>&1 || true

# If gigs.json was modified, commit, push, and open a PR
if git diff --quiet data/gigs.json; then
  log "No new gigs found, nothing to commit"
else
  BRANCH="find-gigs-$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$BRANCH"
  git add data/gigs.json
  GIG_COUNT=$(git diff --cached --numstat data/gigs.json | awk '{print $1}')
  PR_BODY=$(git diff --cached data/gigs.json \
    | grep '^+' | grep -v '^+++' \
    | python3 -c '
import sys, json

lines = sys.stdin.read()
# Extract added JSON objects by finding pollie_slug, role, organisation fields
entries = {}
current = {}
for line in lines.split("\n"):
    line = line.lstrip("+").strip().rstrip(",")
    if not line or line in ("{", "}", "[", "]"):
        if "pollie_slug" in current and "role" in current:
            slug = current["pollie_slug"]
            gig = current.get("role", "")
            org = current.get("organisation", "")
            label = f"{gig}, {org}" if org else gig
            entries.setdefault(slug, []).append(label)
        current = {}
        continue
    try:
        key, val = line.split(":", 1)
        key = json.loads(key)
        val = val.strip()
        if val.startswith("[") or val.startswith("{"):
            continue
        current[key] = json.loads(val)
    except (ValueError, json.JSONDecodeError):
        pass

if "pollie_slug" in current and "role" in current:
    slug = current["pollie_slug"]
    gig = current.get("role", "")
    org = current.get("organisation", "")
    label = f"{gig}, {org}" if org else gig
    entries.setdefault(slug, []).append(label)

if entries:
    parts = []
    for slug, gigs in sorted(entries.items()):
        gig_list = "; ".join(gigs)
        parts.append(f"- **{slug}**: {gig_list}")
    print("New gigs found:\n\n" + "\n".join(parts))
else:
    print("Automated gig search run.")
')
  git commit -m "Add gigs found by cron job"
  git push -u origin "$BRANCH"
  gh pr create \
    --title "Add gigs found by cron job (${GIG_COUNT} lines changed)" \
    --body "$PR_BODY" \
    >> "$LOG_FILE" 2>&1
  git checkout main
  log "PR created on branch ${BRANCH}"
fi

log "=== find-gigs finished ==="
