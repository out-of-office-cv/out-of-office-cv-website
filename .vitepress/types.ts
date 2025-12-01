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

export interface Gig {
  role: string;
  organisation: string;
  category: string;
  verified_by: string;
  source: string;
  pollie_slug: string;
  start_date: string; // ISO format: "2024-03-15"
  end_date?: string;
}
