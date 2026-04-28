#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/ben/projects/out-of-office-cv-website"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/verify-gigs-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

log() { echo "$(date -Iseconds) $*" >> "$LOG_FILE"; }

eval "$(/home/ben/.local/bin/mise activate bash)"

cd "$PROJECT_DIR"

log "=== verify-gigs started ==="

git checkout main >> "$LOG_FILE" 2>&1
git reset --hard >> "$LOG_FILE" 2>&1
git pull --rebase origin main >> "$LOG_FILE" 2>&1

env -u CLAUDECODE /home/ben/.local/bin/claude \
  --dangerously-skip-permissions \
  --effort max \
  -p "/verify-gigs" \
  >> "$LOG_FILE" 2>&1 || true

if git diff --quiet data/gigs.json data/verify-state.json; then
  log "No verification changes, nothing to commit"
else
  BRANCH="verify-gigs-$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$BRANCH"
  git show HEAD:data/gigs.json > /tmp/verify-gigs-old.json
  git add data/gigs.json data/verify-state.json
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
  rm -f /tmp/verify-gigs-old.json /tmp/verify-gigs-title /tmp/verify-gigs-body
  git commit -m "Verify gigs via cron job"
  git push -u origin "$BRANCH"
  gh pr create \
    --title "$PR_TITLE" \
    --body "$PR_BODY" \
    >> "$LOG_FILE" 2>&1
  git checkout main
  log "PR created on branch ${BRANCH}"
fi

log "=== verify-gigs finished ==="
