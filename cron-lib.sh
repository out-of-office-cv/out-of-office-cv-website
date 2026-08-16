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

  # Held across the re-exec in sync_checkout: fd 9 stays open through exec, so
  # taking it again here would be this process waiting on its own lock.
  if [[ "${CRON_LOCK_HELD:-}" == "1" ]]; then
    return 0
  fi
  exec 9>"${PROJECT_DIR}/.cron.lock"
  if flock -w "$wait_secs" 9; then
    export CRON_LOCK_HELD=1
    return 0
  fi
  log "Lock held by the other gig job for ${wait_secs}s, skipping this run"
  return 1
}

# Bring the worktree to origin/main and then re-exec, because this script and
# the library it sources are themselves among the files the checkout can change.
# bash reads a script incrementally, so a run that carried on after swapping its
# own source out would execute the remainder of a different file from a stale
# byte offset. Re-exec is also why the lock is held on a fd rather than retaken.
#
# Detached at origin/main rather than rebasing: a conflict can then never wedge
# the job, and there is no local branch to collide with the one the main
# checkout has out.
sync_checkout_and_reexec() {
  if [[ "${CRON_SYNCED:-}" == "1" ]]; then
    return 0
  fi
  git fetch origin >> "$LOG_FILE" 2>&1
  git checkout -f --detach origin/main >> "$LOG_FILE" 2>&1
  git reset --hard origin/main >> "$LOG_FILE" 2>&1
  export CRON_SYNCED=1
  log "Synced to origin/main, re-executing to pick up the checked-out scripts"
  exec "$0" "$@"
}

# Run one skill under the agent CLI named by AGENT_CLI, leaving its exit status
# in AGENT_EXIT rather than swallowing it: a crashed agent and a genuinely quiet
# run both produce no diff, and only the exit code tells them apart afterwards.
#
# claude is the default, so an unset environment runs exactly as it always has.
# Selecting the runner per job is a matter of an Environment= drop-in on the
# .service --- never the .timer, since editing a timer with Persistent=true
# fires an immediate catch-up of both gig timers at once.
run_agent() {
  local skill="$1"
  local cli="${AGENT_CLI:-claude}"
  local bin
  local -a cmd

  case "$cli" in
    claude)
      bin="${CLAUDE_BIN:-/home/ben/.local/bin/claude}"
      cmd=(env -u CLAUDECODE "$bin" --dangerously-skip-permissions -p "/${skill}")
      ;;
    matilda)
      # --fresh so no earlier session is carried in; the env var silences a
      # stderr nag about auto-approval. Auth is OAuth-only and the token lives
      # in ~/.matilda/, so a stale profile fails the run rather than degrading
      # it --- there is no key to plumb in here.
      bin="${MATILDA_BIN:-/home/ben/.local/share/mise/shims/matilda}"
      cmd=(env -u CLAUDECODE MATILDA_CODE_SUPPRESS_BOGAN_WARNING=1 \
        "$bin" --yolo --fresh "/${skill}")
      ;;
    *)
      log "Unrecognised AGENT_CLI=${cli}, expected claude or matilda"
      exit 1
      ;;
  esac

  if [[ ! -x "$bin" ]]; then
    log "AGENT_CLI=${cli} but ${bin} is not executable"
    exit 1
  fi

  # Recorded before the agent is invoked, so a killed run is still attributable.
  log "Agent: ${cli} $("$bin" --version 2>&1 | head -1)"

  set +e
  "${cmd[@]}" >> "$LOG_FILE" 2>&1
  AGENT_EXIT=$?
  set -e
  if [[ $AGENT_EXIT -eq 0 ]]; then
    log "Agent exited 0"
  else
    log "Agent exited ${AGENT_EXIT}, output may be partial"
  fi
}

# The search-throttle state files (data/find-state.json, data/verify-state.json)
# are untracked: they are machine bookkeeping, not reviewable content, and
# routing them through a PR made the throttle depend on how quickly that PR was
# merged. Untracked files survive `git checkout -f --detach` and `git reset
# --hard`, so the copy in the cron worktree is simply always there, and is
# authoritative.
#
# It is mirrored onto a long-lived branch so it is durable and inspectable
# without ssh. Nothing in a run depends on that mirror succeeding.
STATE_BRANCH="${STATE_BRANCH:-cron-state}"

# Echo the mirror ref, or fail if there is no mirror yet.
state_mirror_ref() {
  local ref="refs/remotes/origin/${STATE_BRANCH}"
  git fetch -q origin "+refs/heads/${STATE_BRANCH}:${ref}" 2>/dev/null || return 1
  git rev-parse -q --verify "$ref"
}

# Restore any state file that is missing --- a fresh worktree, or the first run
# after these files stopped being tracked, where checking out a commit that no
# longer contains them deletes them. Never overwrites a file that is present:
# local is authoritative, the mirror is only a fallback.
load_state() {
  local ref f
  if ! ref="$(state_mirror_ref)"; then
    log "No ${STATE_BRANCH} mirror yet, using whatever state is on disk"
    return 0
  fi
  for f in "$@"; do
    [[ -f "$f" ]] && continue
    if git cat-file -e "${ref}:${f}" 2>/dev/null; then
      git show "${ref}:${f}" > "$f"
      log "Restored ${f} from ${STATE_BRANCH}"
    fi
  done
}

# Mirror the state files onto the state branch, best effort. Built from plumbing
# against a scratch index so it never touches HEAD, the real index, or the
# working tree, and so it cannot disturb the PR the caller is about to open.
mirror_state() {
  local tmp_index tree parent commit ref
  local -a parent_args=()

  tmp_index="$(mktemp -u)"
  if ! GIT_INDEX_FILE="$tmp_index" git add --force -- "$@" 2>>"$LOG_FILE"; then
    log "Could not stage state for the ${STATE_BRANCH} mirror, skipping it"
    rm -f "$tmp_index"
    return 0
  fi
  tree="$(GIT_INDEX_FILE="$tmp_index" git write-tree)"
  rm -f "$tmp_index"

  ref="refs/remotes/origin/${STATE_BRANCH}"
  if parent="$(git rev-parse -q --verify "$ref")"; then
    parent_args=(-p "$parent")
    if [[ "$(git rev-parse "${parent}^{tree}")" == "$tree" ]]; then
      log "State unchanged, nothing to mirror"
      return 0
    fi
  fi

  commit="$(git commit-tree "$tree" "${parent_args[@]}" \
    -m "state: ${JOB_NAME:-cron} $(date -Iseconds)")"
  if git push -q origin "${commit}:refs/heads/${STATE_BRANCH}" 2>>"$LOG_FILE"; then
    log "Mirrored state to ${STATE_BRANCH}"
  else
    log "Could not push the ${STATE_BRANCH} mirror; local state still authoritative"
  fi
}
