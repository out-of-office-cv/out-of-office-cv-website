import { Octokit } from "@octokit/rest";

const STORAGE_KEY_TOKEN = "ooo-github-token";

const isBrowser = typeof window !== "undefined";

const VERIFIER_MAP: Record<string, string> = {
  "out-of-office-cv": "khoi",
  benswift: "ben",
};

export function createGitHubAuth() {
  let token = $state("");
  let username = $state("");
  let isValidatingToken = $state(false);
  let tokenError = $state("");

  let isAuthenticated = $derived(!!username);
  let verifierId = $derived(VERIFIER_MAP[username] || null);
  let canVerify = $derived(verifierId !== null);

  async function validateToken(t: string): Promise<string | null> {
    if (!t) return null;
    isValidatingToken = true;
    tokenError = "";
    try {
      const octokit = new Octokit({ auth: t });
      const { data } = await octokit.users.getAuthenticated();
      return data.login;
    } catch {
      tokenError = "Invalid token or token expired";
      return null;
    } finally {
      isValidatingToken = false;
    }
  }

  async function saveToken(): Promise<void> {
    if (!isBrowser) return;
    const user = await validateToken(token);
    if (user) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      username = user;
    }
  }

  function disconnectGitHub(): void {
    if (!isBrowser) return;
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    token = "";
    username = "";
  }

  async function initAuth(): Promise<void> {
    if (!isBrowser) return;
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (savedToken) {
      token = savedToken;
      const user = await validateToken(savedToken);
      if (user) {
        username = user;
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        token = "";
      }
    }
  }

  function getStoredToken(): string | null {
    if (!isBrowser) return null;
    return localStorage.getItem(STORAGE_KEY_TOKEN);
  }

  return {
    get token() {
      return token;
    },
    set token(v: string) {
      token = v;
    },
    get username() {
      return username;
    },
    get isValidatingToken() {
      return isValidatingToken;
    },
    get tokenError() {
      return tokenError;
    },
    get isAuthenticated() {
      return isAuthenticated;
    },
    get verifierId() {
      return verifierId;
    },
    get canVerify() {
      return canVerify;
    },
    saveToken,
    disconnectGitHub,
    initAuth,
    getStoredToken,
  };
}
