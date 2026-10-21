import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  bridgeStateFor,
  updateBridgeOverlay,
  setupBridgeOverlayResize,
  teardownBridgeOverlayResize,
  __getBridgeOverlayResizeObserverForTest,
  __getBridgeOverlayResizeTimerForTest,
} from "@/engine/overlays/bridgeOverlayManager";
import {
  charts,
  setActiveChartMode,
  setPlanInitialized,
} from "@/state/chart";
import { BRIDGE_OVERLAY_CLASS, BRIDGE_BAR_CLASS } from "@/bridgeOverlay";
import { onStateChange, notifyStateChange, setPostNotifyHook } from "@/state/notify";

class StubResizeObserver {
  callback: ResizeObserverCallback;
  observedElements: Element[] = [];
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
  }
  observe(target: Element) {
    this.observedElements.push(target);
  }
  unobserve(target: Element) {
    this.observedElements = this.observedElements.filter((el) => el !== target);
  }
  disconnect() {
    this.observedElements = [];
  }
}

describe("bridgeOverlayManager", () => {
  let grid: HTMLElement;
  const originalResizeObserver = globalThis.ResizeObserver;

  function addSideTile(toothNo: number, rect: { left: number; top: number; width: number; height: number }) {
    const tile = document.createElement("div");
    tile.className = "tooth-tile side-view";
    tile.setAttribute("data-tooth", String(toothNo));
    tile.getBoundingClientRect = () =>
      ({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        x: rect.left,
        y: rect.top,
        toJSON: () => ({}),
      } as DOMRect);
    grid.appendChild(tile);
    return tile;
  }

  beforeEach(() => {
    globalThis.ResizeObserver = StubResizeObserver as unknown as typeof ResizeObserver;
    teardownBridgeOverlayResize();
    document.body.innerHTML = "";
    charts.status.clear();
    charts.plan.clear();
    setActiveChartMode("status");
    setPlanInitialized(false);

    grid = document.createElement("div");
    grid.id = "toothGrid";
    grid.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 1600,
        height: 300,
        right: 1600,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    document.body.appendChild(grid);
  });

  afterEach(() => {
    teardownBridgeOverlayResize();
    document.body.innerHTML = "";
    charts.status.clear();
    charts.plan.clear();
    setActiveChartMode("status");
    globalThis.ResizeObserver = originalResizeObserver;
  });

  describe("1. toothState lookup & Status/Plan mode switching", () => {
    it("returns undefined for an unpopulated tooth", () => {
      expect(bridgeStateFor(14)).toBeUndefined();
    });

    it("reads minimal bridge tooth state from the active status chart", () => {
      charts.status.set(14, { restorationType: "bridge", restorationMaterial: "gold", bridgePillar: false });
      const state = bridgeStateFor(14);
      expect(state).toBeDefined();
      expect(state?.restorationType).toBe("bridge");
      expect(state?.restorationMaterial).toBe("gold");
      expect(state?.bridgePillar).toBe(false);
    });

    it("switches lookup dynamically when active chart mode changes from status to plan", () => {
      charts.status.set(14, { restorationType: "crown", restorationMaterial: "metal" });
      charts.plan.set(14, { restorationType: "bridge", restorationMaterial: "zircon" });

      setActiveChartMode("status");
      expect(bridgeStateFor(14)?.restorationType).toBe("crown");

      setActiveChartMode("plan");
      expect(bridgeStateFor(14)?.restorationType).toBe("bridge");
      expect(bridgeStateFor(14)?.restorationMaterial).toBe("zircon");
    });
  });

  describe("2. updateBridgeOverlay rendering contract", () => {
    it("renders bridge overlay bars onto #toothGrid when spans exist", () => {
      addSideTile(13, { left: 0, top: 10, width: 100, height: 120 });
      addSideTile(14, { left: 104, top: 10, width: 100, height: 120 });
      charts.status.set(13, { restorationType: "bridge", restorationMaterial: "gold" });
      charts.status.set(14, { restorationType: "bridge", restorationMaterial: "gold" });

      updateBridgeOverlay();

      const overlay = grid.querySelector(`svg.${BRIDGE_OVERLAY_CLASS}`);
      expect(overlay).toBeTruthy();
      expect(overlay?.querySelectorAll(`rect.${BRIDGE_BAR_CLASS}`)).toHaveLength(1);
    });

    it("safely handles missing #toothGrid element without throwing", () => {
      grid.remove();
      expect(() => updateBridgeOverlay()).not.toThrow();
    });

    it("preserves notification ordering: listeners run first, bridge overlay postNotifyHook runs afterward", () => {
      const order: string[] = [];
      const unsub = onStateChange(() => {
        order.push("listener");
      });

      setPostNotifyHook(() => {
        order.push("bridgeOverlay");
      });

      try {
        notifyStateChange();
        expect(order).toEqual(["listener", "bridgeOverlay"]);
      } finally {
        unsub();
        // Restore standard odontogram post-notify hook
        setPostNotifyHook(updateBridgeOverlay);
      }
    });
  });

  describe("3. ResizeObserver lifecycle and debounce behavior", () => {
    it("setupBridgeOverlayResize registers ResizeObserver on #toothGrid", () => {
      setupBridgeOverlayResize();
      const observer = __getBridgeOverlayResizeObserverForTest() as unknown as StubResizeObserver;
      expect(observer).toBeTruthy();
      expect(observer.observedElements).toContain(grid);
    });

    it("teardownBridgeOverlayResize disconnects observer and cleans up timer", () => {
      setupBridgeOverlayResize();
      expect(__getBridgeOverlayResizeObserverForTest()).toBeTruthy();

      teardownBridgeOverlayResize();
      expect(__getBridgeOverlayResizeObserverForTest()).toBeNull();
      expect(__getBridgeOverlayResizeTimerForTest()).toBeNull();
    });

    it("debounces resize events by 100ms", () => {
      vi.useFakeTimers();
      try {
        addSideTile(13, { left: 0, top: 10, width: 100, height: 120 });
        addSideTile(14, { left: 104, top: 10, width: 100, height: 120 });
        charts.status.set(13, { restorationType: "bridge", restorationMaterial: "gold" });
        charts.status.set(14, { restorationType: "bridge", restorationMaterial: "gold" });

        setupBridgeOverlayResize();
        const observer = __getBridgeOverlayResizeObserverForTest() as unknown as StubResizeObserver;
        expect(observer).toBeTruthy();

        // Trigger resize event
        observer.callback([], observer as unknown as ResizeObserver);
        expect(__getBridgeOverlayResizeTimerForTest()).toBeTruthy();

        // Overlay not yet rendered before 100ms
        expect(grid.querySelector(`svg.${BRIDGE_OVERLAY_CLASS}`)).toBeNull();

        // Fast forward 50ms (not yet 100ms)
        vi.advanceTimersByTime(50);
        expect(grid.querySelector(`svg.${BRIDGE_OVERLAY_CLASS}`)).toBeNull();

        // Fire another resize within debounce window
        observer.callback([], observer as unknown as ResizeObserver);

        // Advance 60ms (110ms total, but 60ms since last resize)
        vi.advanceTimersByTime(60);
        expect(grid.querySelector(`svg.${BRIDGE_OVERLAY_CLASS}`)).toBeNull();

        // Advance remaining 40ms -> 100ms reached from second resize
        vi.advanceTimersByTime(40);
        expect(grid.querySelector(`svg.${BRIDGE_OVERLAY_CLASS}`)).toBeTruthy();
        expect(__getBridgeOverlayResizeTimerForTest()).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("teardown cancels pending timer before it fires", () => {
      vi.useFakeTimers();
      try {
        setupBridgeOverlayResize();
        const observer = __getBridgeOverlayResizeObserverForTest() as unknown as StubResizeObserver;
        observer.callback([], observer as unknown as ResizeObserver);
        expect(__getBridgeOverlayResizeTimerForTest()).toBeTruthy();

        teardownBridgeOverlayResize();
        expect(__getBridgeOverlayResizeTimerForTest()).toBeNull();
        expect(__getBridgeOverlayResizeObserverForTest()).toBeNull();

        // Advancing timers should not throw or render
        vi.advanceTimersByTime(200);
        expect(grid.querySelector(`svg.${BRIDGE_OVERLAY_CLASS}`)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("repeated setup and teardown calls are idempotent and leak no observers", () => {
      setupBridgeOverlayResize();
      const firstObserver = __getBridgeOverlayResizeObserverForTest();
      expect(firstObserver).toBeTruthy();

      setupBridgeOverlayResize();
      const secondObserver = __getBridgeOverlayResizeObserverForTest();
      expect(secondObserver).toBeTruthy();
      expect(secondObserver).not.toBe(firstObserver);

      teardownBridgeOverlayResize();
      teardownBridgeOverlayResize();
      expect(__getBridgeOverlayResizeObserverForTest()).toBeNull();
    });
  });
});
