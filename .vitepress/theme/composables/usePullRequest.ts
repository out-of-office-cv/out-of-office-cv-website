import { ref } from "vue";
import { Octokit } from "@octokit/rest";

const REPO_OWNER = "out-of-office-cv";
const REPO_NAME = "out-of-office-cv-website";

export type PrStatus = "idle" | "creating" | "created" | "merged" | "error";

export function usePullRequest(getStoredToken: () => string | null) {
  const prStatus = ref<PrStatus>("idle");
  const prNumber = ref<number | null>(null);
  const prUrl = ref("");
  const prError = ref("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  function startPollingPRStatus(
    prNum: number,
    onMerged: () => void,
  ): void {
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
          prStatus.value = "merged";
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

  function resetPRStatus(): void {
    prStatus.value = "idle";
    prNumber.value = null;
    prUrl.value = "";
    prError.value = "";
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
    prStatus.value = "creating";
    prError.value = "";

    const token = getStoredToken();
    if (!token) {
      prError.value = "No GitHub token found";
      prStatus.value = "error";
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
        path: "data/gigs.ts",
        ref: "main",
      });

      if (!("content" in fileData)) {
        throw new Error("Could not read gigs.ts");
      }

      const currentContent = atob(fileData.content);
      const newContent = options.updateFile(currentContent);

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
        path: "data/gigs.ts",
        message: options.title,
        content: btoa(newContent),
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

      prNumber.value = pr.number;
      prUrl.value = pr.html_url;
      prStatus.value = "created";

      startPollingPRStatus(pr.number, options.onMerged);
    } catch (err) {
      prError.value =
        err instanceof Error ? err.message : "Failed to create PR";
      prStatus.value = "error";
    }
  }

  return {
    prStatus,
    prNumber,
    prUrl,
    prError,
    createPR,
    resetPRStatus,
  };
}
