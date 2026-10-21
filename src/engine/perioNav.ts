import { ALL_TEETH } from "@/anatomy/profiles";
import type { PerioSite } from "@/state/payload";
import type { PerioCellCoord } from "@/engine/types";

// ---- Keyboard charting order ----
// Explicit, pure charting-order table driving the full-mouth grid's keyboard
// auto-advance (PerioChart.tsx). There are two "rows" — pd, then gm. WITHIN
// a row: the buccal sites (MB,B,DB) are charted tooth-by-tooth across the
// arch order (upper then lower — `ALL_TEETH`, the exact array `PerioChart.tsx`
// mirrors as its own module-scope `UPPER_ARCH`/`LOWER_ARCH` concat) before
// moving on to the lingual sites (ML,L,DL) the same way; this mirrors the
// grid's own DOM layout (`buildArch`'s field-row loop: tooth outer, site
// inner) and `PERIO_SITES`' own MB/B/DB/ML/L/DL grouping. Once every lingual
// gm site of the last tooth is reached, the order ends (`nextPerioCell`
// returns `null` — deliberately NOT wrapping back to the first pd cell, so a
// clinician doing a final full-mouth charting pass gets an explicit "done"
// signal rather than looping silently).
//
// Built ONCE at module load (2 rows * 6 sites * 32 teeth = 384 entries) so
// `nextPerioCell`/`prevPerioCell` are plain array lookups, not a
// re-derivation per call. Pure/side-effect-free — no `toothState` read, no
// DOM — safe to unit-test directly, independent of the grid.
export const PERIO_CHART_ROWS = ["pd", "gm"] as const;
export const PERIO_SITE_GROUPS: readonly (readonly PerioSite[])[] = [
  ["MB", "B", "DB"],
  ["ML", "L", "DL"],
];

export const PERIO_CELL_ORDER: PerioCellCoord[] = (() => {
  const order: PerioCellCoord[] = [];
  for(const row of PERIO_CHART_ROWS){
    for(const siteGroup of PERIO_SITE_GROUPS){
      for(const toothNo of ALL_TEETH){
        for(const site of siteGroup){
          order.push({ toothNo, site, row });
        }
      }
    }
  }
  return order;
})();

function perioCellKey(c: { toothNo: number; site: string; row: string }): string {
  return `${c.row}:${c.toothNo}:${c.site}`;
}

export const PERIO_CELL_INDEX: Map<string, number> = new Map(
  PERIO_CELL_ORDER.map((c, i) => [perioCellKey(c), i]),
);

/**
 * Pure charting-order helper for the full-mouth perio grid's keyboard
 * auto-advance (PerioChart.tsx) — given the cell just charted, returns the
 * NEXT cell in charting order (see the order table comment above), or
 * `null` at the very end (last lingual gm site of the last tooth in the
 * arch order). An unrecognized `cur` (a site string not in PERIO_SITES
 * or a `row` other than "pd"/"gm") also returns `null`. Never mutates
 * state — a plain-object round trip, trivially unit-testable in isolation.
 */
export function nextPerioCell(cur: { toothNo: number; site: string; row: "pd" | "gm" }): PerioCellCoord | null {
  const idx = PERIO_CELL_INDEX.get(perioCellKey(cur));
  if(idx === undefined) return null;
  return PERIO_CELL_ORDER[idx + 1] ?? null;
}

/** Reverse of {@link nextPerioCell} — the grid's Left-arrow / previous-cell
 *  step. `null` for an unrecognized `cur` or at the very first cell. */
export function prevPerioCell(cur: { toothNo: number; site: string; row: "pd" | "gm" }): PerioCellCoord | null {
  const idx = PERIO_CELL_INDEX.get(perioCellKey(cur));
  if(idx === undefined || idx === 0) return null;
  return PERIO_CELL_ORDER[idx - 1] ?? null;
}
