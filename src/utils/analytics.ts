import type { GigCategory } from "../types";
import type { PartyGroup } from "./pollie";

export interface AnalyticsRow {
  category: GigCategory;
  partyGroup: PartyGroup;
  decade: string;
}

export interface CategoryTotal {
  category: GigCategory;
  count: number;
}

export interface ColumnCell<Col extends string> {
  category: GigCategory;
  column: Col;
  count: number;
  proportion: number;
  columnTotal: number;
}

export interface AnalyticsData {
  categoryTotals: CategoryTotal[];
  byParty: ColumnCell<PartyGroup>[];
  byDecade: ColumnCell<string>[];
}

function buildColumnCells<Col extends string>(
  rows: AnalyticsRow[],
  columnOf: (row: AnalyticsRow) => Col,
  categoryOrder: GigCategory[],
): ColumnCell<Col>[] {
  const counts = new Map<Col, Map<GigCategory, number>>();
  const columnTotals = new Map<Col, number>();

  for (const row of rows) {
    const col = columnOf(row);
    const inner = counts.get(col) ?? new Map<GigCategory, number>();
    inner.set(row.category, (inner.get(row.category) ?? 0) + 1);
    counts.set(col, inner);
    columnTotals.set(col, (columnTotals.get(col) ?? 0) + 1);
  }

  const columns = Array.from(counts.keys()).sort((a, b) =>
    String(a).localeCompare(String(b)),
  );

  const cells: ColumnCell<Col>[] = [];
  for (const col of columns) {
    const total = columnTotals.get(col) ?? 0;
    const inner = counts.get(col)!;
    for (const category of categoryOrder) {
      const count = inner.get(category) ?? 0;
      if (count === 0) continue;
      cells.push({
        category,
        column: col,
        count,
        columnTotal: total,
        proportion: total === 0 ? 0 : count / total,
      });
    }
  }

  return cells;
}

export function computeAnalytics(rows: AnalyticsRow[]): AnalyticsData {
  const categoryCounts = new Map<GigCategory, number>();
  for (const row of rows) {
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
  }

  const categoryTotals: CategoryTotal[] = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.category.localeCompare(b.category);
    });

  const categoryOrder = categoryTotals.map((t) => t.category);

  return {
    categoryTotals,
    byParty: buildColumnCells(rows, (r) => r.partyGroup, categoryOrder),
    byDecade: buildColumnCells(rows, (r) => r.decade, categoryOrder),
  };
}
