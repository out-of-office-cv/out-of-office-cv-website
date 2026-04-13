import type { Gig, GigCountSplit } from "../types";

export function countGigsByPollie(gigs: Gig[]): Map<string, GigCountSplit> {
  const counts = new Map<string, GigCountSplit>();
  for (const gig of gigs) {
    const current = counts.get(gig.pollie_slug) ?? { verified: 0, unverified: 0 };
    if (gig.verified_by) {
      current.verified += 1;
    } else {
      current.unverified += 1;
    }
    counts.set(gig.pollie_slug, current);
  }
  return counts;
}

function endDateSortKey(endDate: string | undefined): number {
  if (!endDate || endDate === "present" || endDate === "unknown") {
    return Number.POSITIVE_INFINITY;
  }
  const parsed = new Date(
    /^\d{4}$/.test(endDate)
      ? `${endDate}-12-31`
      : /^\d{4}-\d{2}$/.test(endDate)
        ? `${endDate}-01`
        : endDate,
  );
  const time = parsed.getTime();
  return isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

export function sortGigsForDisplay(gigs: Gig[]): Gig[] {
  return [...gigs].sort((a, b) => {
    const aVerified = a.verified_by ? 1 : 0;
    const bVerified = b.verified_by ? 1 : 0;
    if (aVerified !== bVerified) return bVerified - aVerified;
    return endDateSortKey(b.end_date) - endDateSortKey(a.end_date);
  });
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function sortGigsForVerification<T extends Gig>(gigs: T[]): T[] {
  return [...gigs].sort((a, b) => {
    const slugCmp = a.pollie_slug.localeCompare(b.pollie_slug);
    if (slugCmp !== 0) return slugCmp;
    const aHost = a.sources.length > 0 ? hostnameOf(a.sources[0]) : "";
    const bHost = b.sources.length > 0 ? hostnameOf(b.sources[0]) : "";
    return aHost.localeCompare(bHost);
  });
}
