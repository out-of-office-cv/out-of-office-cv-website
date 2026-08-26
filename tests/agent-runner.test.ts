import { execFileSync } from "node:child_process";
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
