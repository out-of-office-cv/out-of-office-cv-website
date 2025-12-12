import { ref, computed } from "vue";
import { Octokit } from "@octokit/rest";

const STORAGE_KEY_TOKEN = "ooo-github-token";

const isBrowser = typeof window !== "undefined";

const VERIFIER_MAP: Record<string, string> = {
  "out-of-office-cv": "khoi",
  benswift: "ben",
};

const githubToken = ref("");
const githubUsername = ref("");
const isValidatingToken = ref(false);
const tokenError = ref("");

export function useGitHubAuth() {
  const isAuthenticated = computed(() => !!githubUsername.value);
  const verifierId = computed(() => VERIFIER_MAP[githubUsername.value] || null);
  const canVerify = computed(() => verifierId.value !== null);

  async function validateToken(token: string): Promise<string | null> {
    if (!token) return null;
    isValidatingToken.value = true;
    tokenError.value = "";
    try {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.users.getAuthenticated();
      return data.login;
    } catch {
      tokenError.value = "Invalid token or token expired";
      return null;
    } finally {
      isValidatingToken.value = false;
    }
  }

  async function saveToken(): Promise<void> {
    if (!isBrowser) return;
    const username = await validateToken(githubToken.value);
    if (username) {
      localStorage.setItem(STORAGE_KEY_TOKEN, githubToken.value);
      githubUsername.value = username;
    }
  }

  function disconnectGitHub(): void {
    if (!isBrowser) return;
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    githubToken.value = "";
    githubUsername.value = "";
  }

  async function initAuth(): Promise<void> {
    if (!isBrowser) return;
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (savedToken) {
      githubToken.value = savedToken;
      const username = await validateToken(savedToken);
      if (username) {
        githubUsername.value = username;
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        githubToken.value = "";
      }
    }
  }

  function getStoredToken(): string | null {
    if (!isBrowser) return null;
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  }

  return {
    githubToken,
    githubUsername,
    isValidatingToken,
    tokenError,
    isAuthenticated,
    verifierId,
    canVerify,
    validateToken,
    saveToken,
    disconnectGitHub,
    initAuth,
    getStoredToken,
  };
}
