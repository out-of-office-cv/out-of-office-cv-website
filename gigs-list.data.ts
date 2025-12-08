import { gigs } from "./data/gigs";
import type { Gig } from "./.vitepress/types";

export interface GigWithIndex extends Gig {
  index: number;
}

declare const data: GigWithIndex[];
export { data };

export default {
  watch: ["./data/gigs.ts"],
  load(): GigWithIndex[] {
    return gigs.map((gig, index) => ({ ...gig, index }));
  },
};
