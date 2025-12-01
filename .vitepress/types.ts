export interface Pollie {
  slug: string;
  name: string;
  division: string;
  state: string;
  party: string;
  ceasedDate: string;
  reason: string;
  stillInOffice: boolean;
}

export type PollieListItem = Pick<
  Pollie,
  "slug" | "name" | "division" | "state" | "party" | "ceasedDate"
>;

export interface PolliesByDecade {
  decade: string;
  pollies: PollieListItem[];
}

export type GigCategory =
  | "consulting"
  | "advocacy"
  | "health"
  | "lobbying"
  | "defence"
  | "public-sector"
  | "education";

export interface Gig {
  role: string;
  organisation: string;
  category: GigCategory;
  source: string;
  verified_by?: string;
  pollie_slug: string;
  start_date: string;
  end_date?: string;
}
