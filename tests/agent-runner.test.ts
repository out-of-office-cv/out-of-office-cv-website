import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectDir = resolve(import.meta.dirname, "..");

function runAgent(environment: Record<string, string>): string[] {
  const temp = mkdtempSync(join(tmpdir(), "ooc-agent-runner-"));
  const calls = join(temp, "calls");
  const dispatcher = join(temp, "agent-run");
  writeFileSync(
    dispatcher,
    `#!/bin/sh
case " $* " in
  *" --describe "*) echo "test dispatcher"; exit 0 ;;
esac
printf '%s\\n' "$@" >> "${calls}"
`,
  );
  chmodSync(dispatcher, 0o755);

  execFileSync(
    "bash",
    ["-c", 'source ./cron-lib.sh; run_agent find-gigs; test "$AGENT_EXIT" -eq 0'],
    {
      cwd: projectDir,
      env: {
        ...process.env,
        PROJECT_DIR: projectDir,
        LOG_FILE: join(temp, "run.log"),
        AGENT_RUN_BIN: dispatcher,
        AGENT_PROFILE: "",
        AGENT_MODEL: "",
        ...environment,
      },
    },
  );

  return readFileSync(calls, "utf8").trim().split("\n");
}

function finishRun(agentExit: string): { status: number | null; log: string; stdout: string } {
  const temp = mkdtempSync(join(tmpdir(), "ooc-finish-run-"));
  const logFile = join(temp, "run.log");

  const result = spawnSync(
    "bash",
    ["-c", `source ./cron-lib.sh; AGENT_EXIT=${agentExit}; finish_run; echo "kept going"`],
    {
      cwd: projectDir,
      encoding: "utf8",
      env: { ...process.env, PROJECT_DIR: projectDir, LOG_FILE: logFile, JOB_NAME: "find-gigs" },
    },
  );

  return { status: result.status, log: readFileSync(logFile, "utf8"), stdout: result.stdout };
}

describe("cron agent dispatcher", () => {
  it("preserves the Claude Sonnet job settings", () => {
    expect(runAgent({ AGENT_MODEL: "sonnet" })).toEqual([
      "--profile",
      "claude-sub",
      "--cwd",
      projectDir,
      "--bypass-permissions",
      "--model",
      "sonnet",
      "/find-gigs",
    ]);
  });

  it("takes an alternative profile without script changes", () => {
    expect(runAgent({ AGENT_PROFILE: "deepseek", AGENT_MODEL: "" })).toContain("deepseek");
  });
});

describe("cron run outcome", () => {
  it("succeeds quietly when the agent exited cleanly", () => {
    const { status, log, stdout } = finishRun("0");

    expect(status).toBe(0);
    expect(log).toContain("=== find-gigs finished ===");
    expect(stdout).toContain("kept going");
  });

  // A dead agent and a genuinely empty search leave the same absent diff, so
  // the exit status is the only thing that tells them apart afterwards.
  it("fails the unit with the agent's own status when the agent died", () => {
    const { status, log, stdout } = finishRun("2");

    expect(status).toBe(2);
    expect(log).toContain("failing the unit: agent exited 2");
    expect(stdout).not.toContain("kept going");
  });
});
