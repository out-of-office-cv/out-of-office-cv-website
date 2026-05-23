const NARROW_QUERY = "(max-width: 36rem)";

export function isNarrowViewport(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches
  );
}

export function watchNarrowViewport(
  onChange: (narrow: boolean) => void,
): () => void {
  const mq = window.matchMedia(NARROW_QUERY);
  const handler = (e: MediaQueryListEvent) => onChange(e.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

// Inserts line breaks before " & " and " and " so long category labels wrap
// to two or three lines on narrow viewports without truncation.
export const wrapCategoryLabelExpr =
  "replace(replace(datum.label, ' & ', '\\n& '), ' and ', '\\nand ')";
