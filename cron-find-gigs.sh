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
  git commit -m "Add gigs found by cron job"
  git push -u origin "$BRANCH"
  gh pr create \
    --title "Add gigs found by cron job (${GIG_COUNT} lines changed)" \
    --body "Automated gig search run. Please review the additions to \`data/gigs.json\`." \
    >> "$LOG_FILE" 2>&1
  git checkout main
  log "PR created on branch ${BRANCH}"
fi

log "=== find-gigs finished ==="
