# shellcheck shell=bash
# Shared helpers for cron-find-gigs.sh and cron-verify-gigs.sh. Sourced, never
# executed: the caller sets PROJECT_DIR and LOG_FILE before sourcing.

log() { echo "$(date -Iseconds) $*" >> "$LOG_FILE"; }

# Serialise the two jobs on one lockfile. Both start with `git checkout -f
# --detach`, so a second run sharing the checkout pulls the ground out from
# under the first. The lockfile is untracked, so `git reset --hard` leaves it
# alone.
#
# Waits rather than giving up the moment it finds the lock held: a serial
# matilda run can hold it for over an hour, and an instant exit would silently
# skip the whole slot. Bounded, though, so a stuck holder can never make this
# run outlive the unit's TimeoutStartSec.
take_lock() {
  local wait_secs="${LOCK_WAIT_SECS:-900}"
  exec 9>"${PROJECT_DIR}/.cron.lock"
  if flock -w "$wait_secs" 9; then
    return 0
  fi
  log "Lock held by the other gig job for ${wait_secs}s, skipping this run"
  return 1
}

# Run one skill under the agent CLI, leaving its exit status in AGENT_EXIT
# rather than swallowing it: a crashed agent and a genuinely quiet run both
# produce no diff, and only the exit code tells them apart afterwards.
run_agent() {
  local skill="$1"
  set +e
  env -u CLAUDECODE /home/ben/.local/bin/claude \
    --dangerously-skip-permissions \
    -p "/${skill}" \
    >> "$LOG_FILE" 2>&1
  AGENT_EXIT=$?
  set -e
  if [[ $AGENT_EXIT -eq 0 ]]; then
    log "Agent exited 0"
  else
    log "Agent exited ${AGENT_EXIT}, output may be partial"
  fi
}
