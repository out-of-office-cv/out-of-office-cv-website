export function parseCSV(content: string): string[][] {
  const lines = content.trim().split("\n");
  return lines.map((line) => {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  });
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  if (dateStr.includes("-")) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;
    return null;
  }

  const parts = dateStr.split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return "";
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatISODate(isoDateStr: string): string {
  const date = new Date(isoDateStr);
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function timeAgo(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return "";
  const now = new Date();
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());
  if (months < 12) {
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
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
  T extends { slug: string; ceasedDate: string; stillInOffice: boolean },
>(pollies: T[]): T[] {
  const pollieMap = new Map<string, T>();

  for (const pollie of pollies) {
    const existing = pollieMap.get(pollie.slug);
    if (!existing) {
      pollieMap.set(pollie.slug, pollie);
    } else {
      const existingDate = parseDate(existing.ceasedDate);
      const newDate = parseDate(pollie.ceasedDate);

      if (pollie.stillInOffice && !existing.stillInOffice) {
        pollieMap.set(pollie.slug, pollie);
      } else if (
        !existing.stillInOffice &&
        !pollie.stillInOffice &&
        newDate &&
        existingDate &&
        newDate > existingDate
      ) {
        pollieMap.set(pollie.slug, pollie);
      }
    }
  }

  return Array.from(pollieMap.values());
}
