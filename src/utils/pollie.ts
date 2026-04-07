import { parseDate } from "./date";

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type PartyColour =
  | "red"
  | "blue"
  | "green"
  | "grey"
  | "orange"
  | "purple";

const partyColourMap: Record<string, PartyColour> = {
  ALP: "red",
  LIB: "blue",
  LNP: "blue",
  CLP: "blue",
  NPA: "green",
  NP: "green",
  Nats: "green",
  NCP: "green",
  GRN: "green",
  IND: "grey",
  PHON: "orange",
  UAP: "orange",
  PUP: "orange",
  AD: "purple",
};

export function getPartyColour(party: string): PartyColour | null {
  return partyColourMap[party] ?? null;
}

export function deduplicatePollies<
  T extends { slug: string; ceasedDate: string },
>(pollies: T[]): T[] {
  const pollieMap = new Map<string, T>();

  for (const pollie of pollies) {
    const existing = pollieMap.get(pollie.slug);
    if (!existing) {
      pollieMap.set(pollie.slug, pollie);
    } else {
      const existingDate = parseDate(existing.ceasedDate);
      const newDate = parseDate(pollie.ceasedDate);

      if (newDate && existingDate && newDate > existingDate) {
        pollieMap.set(pollie.slug, pollie);
      }
    }
  }

  return Array.from(pollieMap.values());
}
