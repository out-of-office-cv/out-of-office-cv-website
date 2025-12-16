export type House = "senate" | "reps";

export interface Pollie {
  slug: string;
  phid: string;
  name: string;
  division: string;
  state: string;
  party: string;
  ceasedDate: string;
  house: House;
  photoUrl: string;
}

export type PollieListItem = Pick<
  Pollie,
  | "slug"
  | "name"
  | "division"
  | "state"
  | "party"
  | "ceasedDate"
  | "house"
  | "photoUrl"
> & {
  gigCount: number;
};

export interface PolliesByDecade {
  decade: string;
  pollies: PollieListItem[];
}

export const GIG_CATEGORIES = [
  "Natural Resources (Mining, Oil & Gas)",
  "Energy (Renewables & Traditional)",
  "Agriculture, Forestry & Fisheries",
  "Environment, Climate & Sustainability",
  "Health, Medical & Aged Care",
  "Pharmaceutical & Biotechnology",
  "Education, Academia & Research",
  "Government, Public Administration & Civil Service",
  "Diplomacy & International Relations",
  "Politics, Campaigning & Party Operations",
  "Defence & Military and Security",
  "Nonprofit, NGO and Charity",
  "Legal & Judicial",
  "Professional Services & Management Consulting",
  "Financial Services and Banking",
  "Technology (Software, IT & Digital Services)",
  "Telecommunications & Network Infrastructure",
  "Media, Communications & Public Relations",
  "Gambling, Gaming and Racing",
  "Retail, Hospitality & Tourism",
  "Arts, Culture & Sport",
  "Science, Engineering & Technical Professions",
  "Retired",
] as const;

export type GigCategory = (typeof GIG_CATEGORIES)[number];

export interface Gig {
  role: string;
  organisation: string;
  category: GigCategory;
  sources: string[];
  verified_by?: string;
  pollie_slug: string;
  start_date?: string;
  end_date?: string;
}
