import { Octokit } from "@octokit/rest";

const REPO_OWNER = "out-of-office-cv";
const REPO_NAME = "out-of-office-cv-website";

function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export type PrStatus = "idle" | "creating" | "created" | "merged" | "error";

export function createPullRequest(getStoredToken: () => string | null) {
  let status = $state<PrStatus>("idle");
  let number = $state<number | null>(null);
  let url = $state("");
  let error = $state("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function startPollingPRStatus(prNum: number, onMerged: () => void): void {
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      const token = getStoredToken();
      if (!token) return;

      const octokit = new Octokit({ auth: token });
      try {
        const { data: pr } = await octokit.pulls.get({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          pull_number: prNum,
        });

        if (pr.merged) {
          status = "merged";
          onMerged();
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        } else if (pr.state === "closed") {
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch {
        // Keep polling on error
      }
    }, 5000);
  }

  function resetStatus(): void {
    status = "idle";
    number = null;
    url = "";
    error = "";
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  async function createPR(options: {
    branchPrefix: string;
    title: string;
    body: string;
    updateFile: (content: string) => string;
    onMerged: () => void;
  }): Promise<void> {
    status = "creating";
    error = "";

    const token = getStoredToken();
    if (!token) {
      error = "No GitHub token found";
      status = "error";
      return;
    }

    const octokit = new Octokit({ auth: token });

    try {
      const { data: mainRef } = await octokit.git.getRef({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        ref: "heads/main",
      });
      const mainSha = mainRef.object.sha;

      const { data: fileData } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: "data/gigs.json",
        ref: "main",
      });

      if (!("content" in fileData)) {
        throw new Error("Could not read gigs.json");
      }

      const currentContent = base64ToUtf8(fileData.content);
      const newContent = options.updateFile(currentContent);

      if (newContent === currentContent) {
        error =
          "These changes have already been made by another user. Please refresh the page to see the latest data.";
        status = "error";
        return;
      }

      const branchName = `${options.branchPrefix}-${Date.now()}`;
      await octokit.git.createRef({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        ref: `refs/heads/${branchName}`,
        sha: mainSha,
      });

      await octokit.repos.createOrUpdateFileContents({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: "data/gigs.json",
        message: options.title,
        content: utf8ToBase64(newContent),
        branch: branchName,
        sha: fileData.sha,
      });

      const { data: pr } = await octokit.pulls.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: options.title,
        body: options.body,
        head: branchName,
        base: "main",
      });

      number = pr.number;
      url = pr.html_url;
      status = "created";

      startPollingPRStatus(pr.number, options.onMerged);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create PR";
      status = "error";
    }
  }

  return {
    get status() {
      return status;
    },
    get number() {
      return number;
    },
    get url() {
      return url;
    },
    get error() {
      return error;
    },
    createPR,
    resetStatus,
  };
}
