import type { Gig, PollieListItem, PolliesByDecade } from "../types";
import { parseDate } from "./date";

export function countVerifiedGigsByPollie(gigs: Gig[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const gig of gigs) {
    if (gig.verified_by) {
      const current = counts.get(gig.pollie_slug) || 0;
      counts.set(gig.pollie_slug, current + 1);
    }
  }
  return counts;
}

export function getDecade(date: Date | null): string {
  if (!date) return "Current";
  const year = date.getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;
  return `${decadeStart}s`;
}

export function isDecade1980sOrLater(decade: string): boolean {
  if (decade === "Current") return true;
  const year = parseInt(decade.replace("s", ""), 10);
  return !isNaN(year) && year >= 1980;
}

export function getPolliesByDecade(
  allPollies: Array<{
    data: {
      slug: string;
      name: string;
      division: string;
      state: string;
      party: string;
      ceasedDate: string;
      house: "senate" | "reps";
      photoUrl: string;
      gigCount: number;
    };
  }>,
): PolliesByDecade[] {
  const polliesWithDate = allPollies
    .map((p) => ({
      ...p.data,
      _ceasedDateParsed: parseDate(p.data.ceasedDate),
    }))
    .sort((a, b) => {
      if (!a._ceasedDateParsed && b._ceasedDateParsed) return -1;
      if (a._ceasedDateParsed && !b._ceasedDateParsed) return 1;
      if (a._ceasedDateParsed && b._ceasedDateParsed) {
        return b._ceasedDateParsed.getTime() - a._ceasedDateParsed.getTime();
      }
      return a.name.localeCompare(b.name);
    });

  const decadeMap = new Map<string, PollieListItem[]>();
  for (const pollie of polliesWithDate) {
    if (!pollie._ceasedDateParsed) continue;

    const decade = getDecade(pollie._ceasedDateParsed);
    if (!isDecade1980sOrLater(decade)) continue;

    const list = decadeMap.get(decade) || [];
    const { _ceasedDateParsed: _, ...pollieData } = pollie;
    list.push(pollieData);
    decadeMap.set(decade, list);
  }

  const decadeOrder = Array.from(decadeMap.keys()).sort((a, b) =>
    b.localeCompare(a),
  );

  return decadeOrder.map((decade) => ({
    decade,
    pollies: decadeMap.get(decade)!,
  }));
}
