import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isTouchDevice,
  getTouchDist,
  onGridTouchStart,
  onGridTouchMove,
  onGridTouchEnd,
  buildArchToggle,
  refreshArchToggleLabels,
  addTouchToTile,
  resetTouchState,
  destroyTouchGestures,
  getPinchScale,
  getArchMode,
  getArchToggleBar,
  LONG_PRESS_MS,
  TOUCH_MOVE_THRESHOLD,
} from "@/engine/gestures/touchGestures";
import { setReadOnlyState } from "@/engine/displayGlobals";
import { setI18nLanguage } from "@/i18n/useI18n";

function createTouch(clientX: number, clientY: number): Touch {
  return { clientX, clientY, identifier: 0, target: document.body } as unknown as Touch;
}

function createTouchEvent(
  type: string,
  touches: Array<{ clientX: number; clientY: number }>,
): TouchEvent {
  const touchList = touches.map((t) => createTouch(t.clientX, t.clientY));
  const evt = new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches: touchList,
  });
  return evt;
}

describe("touchGestures module", () => {
  let grid: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    setI18nLanguage("en");
    setReadOnlyState(false);
    resetTouchState();

    // Setup host and #toothGrid
    grid = document.createElement("div");
    grid.id = "toothGrid";
    document.body.appendChild(grid);
  });

  afterEach(() => {
    destroyTouchGestures(grid);
    document.body.innerHTML = "";
    setReadOnlyState(false);
    setI18nLanguage("en");
  });

  describe("A. isTouchDevice & getTouchDist", () => {
    it("isTouchDevice detects pointer coarse capability", () => {
      window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: q.includes("coarse"),
        media: q,
      }));
      expect(isTouchDevice()).toBe(true);

      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
      }));
      expect(isTouchDevice()).toBe(false);
    });

    it("getTouchDist computes Euclidean distance correctly", () => {
      const t1 = createTouch(0, 0);
      const t2 = createTouch(3, 4);
      expect(getTouchDist(t1, t2)).toBe(5);

      const t3 = createTouch(10, 10);
      expect(getTouchDist(t3, t3)).toBe(0);
    });
  });

  describe("B. Grid pinch scaling & snap-back", () => {
    it("onGridTouchStart activates pinch mode and adds odon-pinch-active class", () => {
      const evt = createTouchEvent("touchstart", [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      const preventSpy = vi.spyOn(evt, "preventDefault");

      onGridTouchStart(evt);

      expect(grid.classList.contains("odon-pinch-active")).toBe(true);
      expect(preventSpy).toHaveBeenCalled();
    });

    it("onGridTouchStart ignores touches with fewer than 2 fingers", () => {
      const evt = createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]);
      const preventSpy = vi.spyOn(evt, "preventDefault");

      onGridTouchStart(evt);

      expect(grid.classList.contains("odon-pinch-active")).toBe(false);
      expect(preventSpy).not.toHaveBeenCalled();
    });

    it("onGridTouchMove scales grid within limits [0.5, 3]", () => {
      // Start with dist = 100
      onGridTouchStart(
        createTouchEvent("touchstart", [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ]),
      );

      // Move to dist = 200 (scale 2.0)
      const moveEvt = createTouchEvent("touchmove", [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ]);
      const preventSpy = vi.spyOn(moveEvt, "preventDefault");
      onGridTouchMove(moveEvt);

      expect(grid.style.transform).toBe("scale(2)");
      expect(preventSpy).toHaveBeenCalled();

      // Zoom out to dist = 20 -> clamped to 0.5
      onGridTouchMove(
        createTouchEvent("touchmove", [
          { clientX: 90, clientY: 100 },
          { clientX: 110, clientY: 100 },
        ]),
      );
      expect(grid.style.transform).toBe("scale(0.5)");

      // Zoom in to dist = 500 -> clamped to 3
      onGridTouchMove(
        createTouchEvent("touchmove", [
          { clientX: 0, clientY: 100 },
          { clientX: 500, clientY: 100 },
        ]),
      );
      expect(grid.style.transform).toBe("scale(3)");
    });

    it("onGridTouchEnd snaps back when scale is between 0.9 and 1.1", () => {
      onGridTouchStart(
        createTouchEvent("touchstart", [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ]),
      );

      // Scale to ~1.05
      onGridTouchMove(
        createTouchEvent("touchmove", [
          { clientX: 98, clientY: 100 },
          { clientX: 203, clientY: 100 },
        ]),
      );
      expect(grid.classList.contains("odon-pinch-active")).toBe(true);

      // Release pinch (less than 2 touches)
      onGridTouchEnd(createTouchEvent("touchend", []));

      expect(getPinchScale()).toBe(1);
      expect(grid.style.transform).toBe("");
      expect(grid.classList.contains("odon-pinch-active")).toBe(false);
    });

    it("onGridTouchEnd preserves scale when zoomed outside snap-back interval", () => {
      onGridTouchStart(
        createTouchEvent("touchstart", [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ]),
      );

      // Scale to 2.0
      onGridTouchMove(
        createTouchEvent("touchmove", [
          { clientX: 50, clientY: 100 },
          { clientX: 250, clientY: 100 },
        ]),
      );

      onGridTouchEnd(createTouchEvent("touchend", []));

      expect(getPinchScale()).toBe(2);
      expect(grid.style.transform).toBe("scale(2)");
    });
  });

  describe("C. Arch toggle bar creation & labeling", () => {
    it("buildArchToggle inserts toggle bar before grid and switches arch modes", () => {
      buildArchToggle();

      const bar = getArchToggleBar();
      expect(bar).not.toBeNull();
      expect(document.querySelector(".odon-arch-toggle")).toBe(bar);

      const btns = bar!.querySelectorAll<HTMLButtonElement>(".odon-arch-btn");
      expect(btns.length).toBe(3); // Upper, Both, Lower
      const [btnUpper, btnBoth, btnLower] = btns;

      // Initial state is "both"
      expect(getArchMode()).toBe("both");
      expect(btnBoth.classList.contains("active")).toBe(true);

      // Click Upper
      btnUpper.click();
      expect(getArchMode()).toBe("upper");
      expect(btnUpper.classList.contains("active")).toBe(true);
      expect(grid.classList.contains("odon-arch-upper")).toBe(true);

      // Click Upper again toggles back to "both"
      btnUpper.click();
      expect(getArchMode()).toBe("both");
      expect(grid.classList.contains("odon-arch-upper")).toBe(false);

      // Click Lower
      btnLower.click();
      expect(getArchMode()).toBe("lower");
      expect(grid.classList.contains("odon-arch-lower")).toBe(true);

      // Click Both
      btnBoth.click();
      expect(getArchMode()).toBe("both");
      expect(grid.classList.contains("odon-arch-lower")).toBe(false);
    });

    it("refreshArchToggleLabels updates button labels after language switch", () => {
      buildArchToggle();
      const bar = getArchToggleBar()!;
      const btns = bar.querySelectorAll(".odon-arch-btn");

      expect(btns[0].textContent).toBe("Upper arch");
      expect(btns[1].textContent).toBe("Both");
      expect(btns[2].textContent).toBe("Lower arch");

      setI18nLanguage("uk");
      refreshArchToggleLabels();

      expect(btns[0].textContent).toBe("Верхня дуга");
      expect(btns[1].textContent).toBe("Обидві дуги");
      expect(btns[2].textContent).toBe("Нижня дуга");
    });
  });

  describe("D. Tile touch wiring: tap, long-press, movement cancellation, read-only", () => {
    it("short tap (< 500ms) triggers onShortTap and prevents default", () => {
      const tile = document.createElement("div");
      document.body.appendChild(tile);

      const onShortTap = vi.fn();
      const onLongPress = vi.fn();

      addTouchToTile(tile, 16, { onShortTap, onLongPress });

      tile.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));

      const endEvt = createTouchEvent("touchend", []);
      const preventSpy = vi.spyOn(endEvt, "preventDefault");
      tile.dispatchEvent(endEvt);

      expect(onShortTap).toHaveBeenCalledWith(16);
      expect(onLongPress).not.toHaveBeenCalled();
      expect(preventSpy).toHaveBeenCalled();
    });

    it("long press (> 500ms) triggers onLongPress with touch coordinates", () => {
      const tile = document.createElement("div");
      document.body.appendChild(tile);

      const onShortTap = vi.fn();
      const onLongPress = vi.fn();

      addTouchToTile(tile, 16, { onShortTap, onLongPress });

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        tile.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 150, clientY: 250 }]));

        vi.advanceTimersByTime(LONG_PRESS_MS + 50);

        expect(onLongPress).toHaveBeenCalledTimes(1);
        expect(onLongPress.mock.calls[0][0]).toBe(16);
        expect(onLongPress.mock.calls[0][1].clientX).toBe(150);
        expect(onLongPress.mock.calls[0][1].clientY).toBe(250);
      } finally {
        vi.useRealTimers();
      }
    });

    it("movement exceeding TOUCH_MOVE_THRESHOLD cancels long press and short tap", () => {
      const tile = document.createElement("div");
      document.body.appendChild(tile);

      const onShortTap = vi.fn();
      const onLongPress = vi.fn();

      addTouchToTile(tile, 16, { onShortTap, onLongPress });

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        tile.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));

        // Move > TOUCH_MOVE_THRESHOLD (10px)
        tile.dispatchEvent(
          createTouchEvent("touchmove", [
            { clientX: 100 + TOUCH_MOVE_THRESHOLD + 5, clientY: 100 },
          ]),
        );

        vi.advanceTimersByTime(LONG_PRESS_MS + 50);
        expect(onLongPress).not.toHaveBeenCalled();

        tile.dispatchEvent(createTouchEvent("touchend", []));
        expect(onShortTap).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });

    it("read-only mode blocks touch gestures on tiles", () => {
      setReadOnlyState(true);

      const tile = document.createElement("div");
      document.body.appendChild(tile);

      const onShortTap = vi.fn();
      const onLongPress = vi.fn();

      addTouchToTile(tile, 16, { onShortTap, onLongPress });

      tile.dispatchEvent(createTouchEvent("touchstart", [{ clientX: 100, clientY: 100 }]));
      tile.dispatchEvent(createTouchEvent("touchend", []));

      expect(onShortTap).not.toHaveBeenCalled();
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe("E. Teardown and reset", () => {
    it("destroyTouchGestures cleans up listeners, classes, and arch toggle bar", () => {
      buildArchToggle();
      grid.classList.add("odon-pinch-active", "odon-arch-upper");
      grid.style.transform = "scale(2)";

      destroyTouchGestures(grid);

      expect(getArchToggleBar()).toBeNull();
      expect(document.querySelector(".odon-arch-toggle")).toBeNull();
      expect(grid.style.transform).toBe("");
      expect(grid.classList.contains("odon-pinch-active")).toBe(false);
      expect(grid.classList.contains("odon-arch-upper")).toBe(false);
      expect(getPinchScale()).toBe(1);
      expect(getArchMode()).toBe("both");
    });
  });
});
