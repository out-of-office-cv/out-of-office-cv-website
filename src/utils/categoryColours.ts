import { GIG_CATEGORIES, type GigCategory } from "../types";

const palette: readonly string[] = [
  "oklch(52% 0.10 35)",   // Natural Resources (Mining, Oil & Gas)
  "oklch(58% 0.13 65)",   // Energy (Renewables & Traditional)
  "oklch(60% 0.11 110)",  // Agriculture, Forestry & Fisheries
  "oklch(50% 0.10 145)",  // Environment, Climate & Sustainability
  "oklch(54% 0.10 175)",  // Health, Medical & Aged Care
  "oklch(50% 0.10 200)",  // Pharmaceutical & Biotechnology
  "oklch(48% 0.09 230)",  // Education, Academia & Research
  "oklch(46% 0.10 255)",  // Government, Public Administration & Civil Service
  "oklch(50% 0.11 280)",  // Diplomacy & International Relations
  "oklch(48% 0.12 305)",  // Politics, Campaigning & Party Operations
  "oklch(46% 0.10 335)",  // Defence & Military and Security
  "oklch(56% 0.09 5)",    // Nonprofit, NGO and Charity
  "oklch(50% 0.09 50)",   // Legal & Judicial
  "oklch(54% 0.07 90)",   // Professional Services & Management Consulting
  "oklch(50% 0.10 130)",  // Financial Services and Banking
  "oklch(54% 0.11 165)",  // Technology (Software, IT & Digital Services)
  "oklch(50% 0.10 195)",  // Telecommunications & Network Infrastructure
  "oklch(48% 0.11 220)",  // Media, Communications & Public Relations
  "oklch(50% 0.13 25)",   // Gambling, Gaming and Racing
  "oklch(58% 0.10 75)",   // Retail, Hospitality & Tourism
  "oklch(54% 0.12 320)",  // Arts, Culture & Sport
  "oklch(48% 0.08 155)",  // Science, Engineering & Technical Professions
  "oklch(58% 0.02 90)",   // Retired
];

if (palette.length !== GIG_CATEGORIES.length) {
  throw new Error(
    `Category palette length (${palette.length}) must match GIG_CATEGORIES length (${GIG_CATEGORIES.length})`,
  );
}

export const categoryColours: Record<GigCategory, string> = Object.fromEntries(
  GIG_CATEGORIES.map((cat, i) => [cat, palette[i]]),
) as Record<GigCategory, string>;

export const categoryColourArray: readonly string[] = palette;
