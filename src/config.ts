export const REPO_OWNER = "out-of-office-cv";
export const REPO_NAME = "out-of-office-cv-website";
export const REPO_BASE_BRANCH = "main";
export const DATA_FILE_PATH = "data/gigs.json";

export const VERIFIER_MAP: Record<string, string> = {
  "out-of-office-cv": "khoi",
  benswift: "ben",
};

export function getVerifierId(githubUsername: string): string | null {
  return VERIFIER_MAP[githubUsername] ?? null;
}
