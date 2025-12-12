import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPollies } from "./.vitepress/loaders";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

export interface PollieOption {
  slug: string;
  name: string;
}

declare const data: PollieOption[];
export { data };

export default {
  watch: ["./data/representatives.csv", "./data/senators.csv"],
  load(): PollieOption[] {
    const pollies = loadPollies(resolve(rootDir, "data"));

    return pollies
      .map((p) => ({ slug: p.slug, name: p.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
};
