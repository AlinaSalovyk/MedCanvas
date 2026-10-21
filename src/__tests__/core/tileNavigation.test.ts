import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NAV_ROWS,
  isTileNavigable,
  navigateToTooth,
  onToothKeydown,
  handleToothKeydown,
} from "@/engine/navigation/tileNavigation";
import { setReadOnlyState } from "@/engine/displayGlobals";

describe("tileNavigation module", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    setReadOnlyState(false);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    setReadOnlyState(false);
  });

  describe("A. NAV_ROWS layout and ordering", () => {
    it("contains exactly two arch rows with 16 teeth each in FDI notation", () => {
      expect(NAV_ROWS.length).toBe(2);
      expect(NAV_ROWS[0]).toEqual([
        18, 17, 16, 15, 14, 13, 12, 11,
        21, 22, 23, 24, 25, 26, 27, 28,
      ]);
      expect(NAV_ROWS[1]).toEqual([
        48, 47, 46, 45, 44, 43, 42, 41,
        31, 32, 33, 34, 35, 36, 37, 38,
      ]);
    });
  });

  describe("B. isTileNavigable predicate", () => {
    it("returns false if getTiles returns undefined or empty list", () => {
      expect(isTileNavigable(16, () => undefined)).toBe(false);
      expect(isTileNavigable(16, () => [])).toBe(false);
    });

    it("returns true if tile has neither wisdom-hidden nor placeholder", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view";
      expect(isTileNavigable(16, () => [tile])).toBe(true);
    });

    it("returns false if all tiles have wisdom-hidden", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view wisdom-hidden";
      expect(isTileNavigable(18, () => [tile])).toBe(false);
    });

    it("returns false if all tiles have placeholder", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view placeholder";
      expect(isTileNavigable(16, () => [tile])).toBe(false);
    });

    it("returns true if at least one variant tile is navigable", () => {
      const t1 = document.createElement("div");
      t1.className = "tooth-tile occl-view wisdom-hidden";
      const t2 = document.createElement("div");
      t2.className = "tooth-tile side-view";
      expect(isTileNavigable(18, () => [t1, t2])).toBe(true);
    });
  });

  describe("C. navigateToTooth spatial navigation", () => {
    function createMockRegistry(hiddenTeeth: Set<number> = new Set()) {
      const registry = new Map<number, HTMLElement[]>();
      for (const row of NAV_ROWS) {
        for (const tn of row) {
          const tile = document.createElement("div");
          tile.className = "tooth-tile side-view";
          tile.setAttribute("tabindex", "0");
          if (hiddenTeeth.has(tn)) {
            tile.classList.add("wisdom-hidden");
          }
          document.body.appendChild(tile);
          registry.set(tn, [tile]);
        }
      }
      return (tn: number) => registry.get(tn);
    }

    it("returns null if current tooth is not in NAV_ROWS", () => {
      const getTiles = createMockRegistry();
      expect(navigateToTooth(99, "ArrowRight", getTiles)).toBeNull();
    });

    it("ArrowRight moves to adjacent tooth to the right", () => {
      const getTiles = createMockRegistry();
      const target = navigateToTooth(18, "ArrowRight", getTiles);
      expect(target).toBe(17);
      expect(document.activeElement).toBe(getTiles(17)![0]);
    });

    it("ArrowLeft moves to adjacent tooth to the left", () => {
      const getTiles = createMockRegistry();
      const target = navigateToTooth(17, "ArrowLeft", getTiles);
      expect(target).toBe(18);
      expect(document.activeElement).toBe(getTiles(18)![0]);
    });

    it("ArrowRight crosses midline in upper arch (11 -> 21)", () => {
      const getTiles = createMockRegistry();
      const target = navigateToTooth(11, "ArrowRight", getTiles);
      expect(target).toBe(21);
      expect(document.activeElement).toBe(getTiles(21)![0]);
    });

    it("ArrowLeft crosses midline in upper arch (21 -> 11)", () => {
      const getTiles = createMockRegistry();
      const target = navigateToTooth(21, "ArrowLeft", getTiles);
      expect(target).toBe(11);
      expect(document.activeElement).toBe(getTiles(11)![0]);
    });

    it("ArrowRight crosses midline in lower arch (41 -> 31)", () => {
      const getTiles = createMockRegistry();
      const target = navigateToTooth(41, "ArrowRight", getTiles);
      expect(target).toBe(31);
      expect(document.activeElement).toBe(getTiles(31)![0]);
    });

    it("ArrowLeft crosses midline in lower arch (31 -> 41)", () => {
      const getTiles = createMockRegistry();
      const target = navigateToTooth(31, "ArrowLeft", getTiles);
      expect(target).toBe(41);
      expect(document.activeElement).toBe(getTiles(41)![0]);
    });

    it("returns null at row boundaries when no further tooth exists", () => {
      const getTiles = createMockRegistry();
      // Right boundary of upper arch
      expect(navigateToTooth(28, "ArrowRight", getTiles)).toBeNull();
      // Left boundary of upper arch
      expect(navigateToTooth(18, "ArrowLeft", getTiles)).toBeNull();
      // Right boundary of lower arch
      expect(navigateToTooth(38, "ArrowRight", getTiles)).toBeNull();
      // Left boundary of lower arch
      expect(navigateToTooth(48, "ArrowLeft", getTiles)).toBeNull();
    });

    it("ArrowDown transitions from upper arch row to lower arch row", () => {
      const getTiles = createMockRegistry();
      // Tooth 11 is index 7 in upper arch -> Tooth 41 is index 7 in lower arch
      const target = navigateToTooth(11, "ArrowDown", getTiles);
      expect(target).toBe(41);
      expect(document.activeElement).toBe(getTiles(41)![0]);
    });

    it("ArrowUp transitions from lower arch row to upper arch row", () => {
      const getTiles = createMockRegistry();
      // Tooth 41 is index 7 in lower arch -> Tooth 11 is index 7 in upper arch
      const target = navigateToTooth(41, "ArrowUp", getTiles);
      expect(target).toBe(11);
      expect(document.activeElement).toBe(getTiles(11)![0]);
    });

    it("ArrowDown on lower arch returns null (no row below)", () => {
      const getTiles = createMockRegistry();
      expect(navigateToTooth(41, "ArrowDown", getTiles)).toBeNull();
    });

    it("ArrowUp on upper arch returns null (no row above)", () => {
      const getTiles = createMockRegistry();
      expect(navigateToTooth(11, "ArrowUp", getTiles)).toBeNull();
    });

    it("skips non-navigable teeth horizontally", () => {
      // 17 is hidden
      const getTiles = createMockRegistry(new Set([17]));
      const target = navigateToTooth(18, "ArrowRight", getTiles);
      expect(target).toBe(16);
      expect(document.activeElement).toBe(getTiles(16)![0]);
    });

    it("searches forward first then falls back backward when vertically landing on hidden tooth", () => {
      // Lower tooth 41 (col 7) and 31 (col 8) are hidden
      // Tooth 11 (col 7) pressing ArrowDown should check 41 (hidden), then forward to 31 (hidden), then 32 (col 9, navigable)
      const getTiles = createMockRegistry(new Set([41, 31]));
      const target = navigateToTooth(11, "ArrowDown", getTiles);
      expect(target).toBe(32);
      expect(document.activeElement).toBe(getTiles(32)![0]);
    });

    it("falls back backward if all forward teeth in the target row are hidden", () => {
      // Hide all lower teeth from col 7 to 15 (41, 31..38)
      const hidden = new Set([41, 31, 32, 33, 34, 35, 36, 37, 38]);
      const getTiles = createMockRegistry(hidden);
      // Tooth 11 (col 7) pressing ArrowDown: forward fails, backward fallback finds 42 (col 6)
      const target = navigateToTooth(11, "ArrowDown", getTiles);
      expect(target).toBe(42);
      expect(document.activeElement).toBe(getTiles(42)![0]);
    });

    it("handles target tooth with no .side-view tile gracefully without throwing", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile occl-view"; // Not side-view
      const getTiles = (tn: number) => (tn === 17 ? [tile] : []);
      // Should find 17, but sideTile is undefined, does not call focus
      const target = navigateToTooth(18, "ArrowRight", getTiles);
      expect(target).toBe(17);
    });
  });

  describe("D. onToothKeydown event dispatch", () => {
    it("Enter calls onSelect and prevents default", () => {
      const onSelect = vi.fn();
      const onClearSelection = vi.fn();
      const evt = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
      const preventSpy = vi.spyOn(evt, "preventDefault");

      onToothKeydown(16, evt, {
        getTiles: () => undefined,
        onSelect,
        onClearSelection,
      });

      expect(preventSpy).toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith(16, evt);
      expect(onClearSelection).not.toHaveBeenCalled();
    });

    it("Space calls onSelect and prevents default", () => {
      const onSelect = vi.fn();
      const onClearSelection = vi.fn();
      const evt = new KeyboardEvent("keydown", { key: " ", cancelable: true });
      const preventSpy = vi.spyOn(evt, "preventDefault");

      onToothKeydown(21, evt, {
        getTiles: () => undefined,
        onSelect,
        onClearSelection,
      });

      expect(preventSpy).toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith(21, evt);
      expect(onClearSelection).not.toHaveBeenCalled();
    });

    it("Ctrl+Enter preserves ctrlKey modifier in event passed to onSelect", () => {
      const onSelect = vi.fn();
      const onClearSelection = vi.fn();
      const evt = new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, cancelable: true });

      onToothKeydown(16, evt, {
        getTiles: () => undefined,
        onSelect,
        onClearSelection,
      });

      expect(onSelect).toHaveBeenCalledWith(16, evt);
      expect(onSelect.mock.calls[0][1].ctrlKey).toBe(true);
    });

    it("Escape calls onClearSelection and prevents default", () => {
      const onSelect = vi.fn();
      const onClearSelection = vi.fn();
      const evt = new KeyboardEvent("keydown", { key: "Escape", cancelable: true });
      const preventSpy = vi.spyOn(evt, "preventDefault");

      onToothKeydown(16, evt, {
        getTiles: () => undefined,
        onSelect,
        onClearSelection,
      });

      expect(preventSpy).toHaveBeenCalled();
      expect(onClearSelection).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("Arrow keys call navigateToTooth and prevent default", () => {
      const tile17 = document.createElement("div");
      tile17.className = "tooth-tile side-view";
      tile17.setAttribute("tabindex", "0");
      document.body.appendChild(tile17);

      const getTiles = (tn: number) => (tn === 17 ? [tile17] : []);
      const onSelect = vi.fn();
      const onClearSelection = vi.fn();
      const evt = new KeyboardEvent("keydown", { key: "ArrowRight", cancelable: true });
      const preventSpy = vi.spyOn(evt, "preventDefault");

      onToothKeydown(18, evt, {
        getTiles,
        onSelect,
        onClearSelection,
      });

      expect(preventSpy).toHaveBeenCalled();
      expect(document.activeElement).toBe(tile17);
      expect(onSelect).not.toHaveBeenCalled();
      expect(onClearSelection).not.toHaveBeenCalled();
    });

    it("suppresses all keyboard actions in read-only mode", () => {
      setReadOnlyState(true);

      const onSelect = vi.fn();
      const onClearSelection = vi.fn();
      const evt = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
      const preventSpy = vi.spyOn(evt, "preventDefault");

      onToothKeydown(16, evt, {
        getTiles: () => undefined,
        onSelect,
        onClearSelection,
      });

      expect(preventSpy).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
      expect(onClearSelection).not.toHaveBeenCalled();
    });

    it("unhandled keys do not prevent default or trigger callbacks", () => {
      const onSelect = vi.fn();
      const onClearSelection = vi.fn();
      const evt = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
      const preventSpy = vi.spyOn(evt, "preventDefault");

      handleToothKeydown(16, evt, {
        getTiles: () => undefined,
        onSelect,
        onClearSelection,
      });

      expect(preventSpy).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
      expect(onClearSelection).not.toHaveBeenCalled();
    });
  });
});
