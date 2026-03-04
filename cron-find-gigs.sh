#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/ben/projects/out-of-office-cv-website"
LOG_DIR="${PROJECT_DIR}/logs"
LOG_FILE="${LOG_DIR}/find-gigs-$(date +%Y-%m-%d).log"

mkdir -p "$LOG_DIR"

# mise activates tool shims into PATH (node, npm, etc.)
eval "$(/home/ben/.local/bin/mise activate bash)"

cd "$PROJECT_DIR"

echo "=== find-gigs started at $(date -Iseconds) ===" >> "$LOG_FILE"

/home/ben/.local/bin/claude \
  --dangerously-skip-permissions \
  -p "/find-gigs" \
  >> "$LOG_FILE" 2>&1

echo "=== find-gigs finished at $(date -Iseconds) ===" >> "$LOG_FILE"
