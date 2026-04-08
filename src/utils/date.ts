export type DateValidation =
  | { valid: true; format: "full" | "year-month" | "year" }
  | { valid: false }

export const DATE_HINT = "YYYY, YYYY-MM, or YYYY-MM-DD"

export function validateGigDate(value: string): DateValidation {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value)
    return isNaN(d.getTime()) ? { valid: false } : { valid: true, format: "full" }
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    const d = new Date(`${value}-01`)
    return isNaN(d.getTime()) ? { valid: false } : { valid: true, format: "year-month" }
  }
  if (/^\d{4}$/.test(value)) {
    return { valid: true, format: "year" }
  }
  return { valid: false }
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
  if (!isoDateStr || isoDateStr === "unknown" || isoDateStr === "present")
    return isoDateStr || "";

  const yearOnly = /^\d{4}$/.test(isoDateStr);
  if (yearOnly) return isoDateStr;

  const yearMonth = /^\d{4}-\d{2}$/.test(isoDateStr);
  if (yearMonth) {
    const date = new Date(`${isoDateStr}-01`);
    if (isNaN(date.getTime())) return isoDateStr;
    return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  }

  const date = new Date(isoDateStr);
  if (isNaN(date.getTime())) return isoDateStr;
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
