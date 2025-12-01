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
  source: string; // URL to source
  verified_by?: string; // name of person who verified this info
  pollie_slug: string;
  start_date: string; // ISO format: "2024-03-15"
  end_date?: string;
}
