import { readOnly } from "@/engine/displayGlobals";

/**
 * FDI tooth ordering across both dental arches for 2D spatial keyboard navigation.
 * Row 0: Upper arch (18..11, 21..28)
 * Row 1: Lower arch (48..41, 31..38)
 */
export const NAV_ROWS: readonly (readonly number[])[] = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
];

export type TileLookup = (toothNo: number) => HTMLElement[] | undefined;

/**
 * Checks whether a tooth has at least one navigable tile in the DOM registry
 * (i.e. not hidden as wisdom tooth and not a placeholder).
 */
export function isTileNavigable(
  toothNo: number,
  getTiles: TileLookup,
): boolean {
  const tiles = getTiles(toothNo);
  if (!tiles || tiles.length === 0) return false;
  return tiles.some(
    (t) => !t.classList.contains("wisdom-hidden") && !t.classList.contains("placeholder"),
  );
}

/**
 * Moves focus to the next navigable tooth in the given arrow direction.
 * ArrowRight/ArrowLeft traverse horizontally within the same row.
 * ArrowDown/ArrowUp transition between rows, first searching forward from the column,
 * then falling back backward.
 * Focuses the `.side-view` tile of the resolved target tooth.
 * Does NOT mutate selection or active tooth.
 *
 * @returns The target tooth number that was focused, or null if no navigable target was found.
 */
export function navigateToTooth(
  currentTooth: number,
  direction: string,
  getTiles: TileLookup,
): number | null {
  const rowIdx = NAV_ROWS.findIndex((r) => r.includes(currentTooth));
  if (rowIdx < 0) return null;
  const row = NAV_ROWS[rowIdx];
  const colIdx = row.indexOf(currentTooth);

  let targetTooth: number | null = null;
  if (direction === "ArrowRight") {
    for (let i = colIdx + 1; i < row.length; i++) {
      if (isTileNavigable(row[i], getTiles)) {
        targetTooth = row[i];
        break;
      }
    }
  } else if (direction === "ArrowLeft") {
    for (let i = colIdx - 1; i >= 0; i--) {
      if (isTileNavigable(row[i], getTiles)) {
        targetTooth = row[i];
        break;
      }
    }
  } else if (direction === "ArrowDown") {
    if (rowIdx < NAV_ROWS.length - 1) {
      const nextRow = NAV_ROWS[rowIdx + 1];
      const nextCol = Math.min(colIdx, nextRow.length - 1);
      for (let i = nextCol; i < nextRow.length; i++) {
        if (isTileNavigable(nextRow[i], getTiles)) {
          targetTooth = nextRow[i];
          break;
        }
      }
      if (!targetTooth) {
        for (let i = nextCol - 1; i >= 0; i--) {
          if (isTileNavigable(nextRow[i], getTiles)) {
            targetTooth = nextRow[i];
            break;
          }
        }
      }
    }
  } else if (direction === "ArrowUp") {
    if (rowIdx > 0) {
      const prevRow = NAV_ROWS[rowIdx - 1];
      const prevCol = Math.min(colIdx, prevRow.length - 1);
      for (let i = prevCol; i < prevRow.length; i++) {
        if (isTileNavigable(prevRow[i], getTiles)) {
          targetTooth = prevRow[i];
          break;
        }
      }
      if (!targetTooth) {
        for (let i = prevCol - 1; i >= 0; i--) {
          if (isTileNavigable(prevRow[i], getTiles)) {
            targetTooth = prevRow[i];
            break;
          }
        }
      }
    }
  }

  if (targetTooth !== null) {
    const tiles = getTiles(targetTooth);
    const sideTile = tiles?.find((t: HTMLElement) => t.classList.contains("side-view"));
    if (sideTile) sideTile.focus();
  }

  return targetTooth;
}

export interface ToothKeydownCallbacks {
  getTiles: TileLookup;
  onSelect: (toothNo: number, evt: KeyboardEvent) => void;
  onClearSelection: () => void;
}

/**
 * Handles tooth tile keyboard events.
 * Enter / Space: delegates to selection callback (with modifier keys preserved).
 * Arrow keys: moves focus to neighboring navigable tooth.
 * Escape: clears selection.
 * Suppressed when readOnly is true.
 */
export function onToothKeydown(
  toothNo: number,
  evt: KeyboardEvent,
  callbacks: ToothKeydownCallbacks,
): void {
  if (readOnly) return;
  switch (evt.key) {
    case "Enter":
    case " ":
      evt.preventDefault();
      callbacks.onSelect(toothNo, evt);
      break;
    case "ArrowRight":
    case "ArrowLeft":
    case "ArrowUp":
    case "ArrowDown":
      evt.preventDefault();
      navigateToTooth(toothNo, evt.key, callbacks.getTiles);
      break;
    case "Escape":
      evt.preventDefault();
      callbacks.onClearSelection();
      break;
  }
}

export { onToothKeydown as handleToothKeydown };
