import type { Gig } from "../.vitepress/types";
import gigsJson from "./gigs.json" with { type: "json" };

export const gigs = gigsJson as Gig[];
