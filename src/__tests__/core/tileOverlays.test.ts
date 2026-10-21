import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  showZoomPopover,
  hideZoomPopover,
  showContextMenu,
  hideContextMenu,
  showNoteEditor,
  hideNoteEditor,
  type ZoomPopoverDeps,
  type ContextMenuDeps,
  type NoteEditorDeps,
} from "@/engine/overlays/tileOverlays";
import {
  selectedTeeth,
  activeTooth,
  setActiveTooth,
  setSelectedTeeth,
} from "@/engine/selection";
import { setNotesEnabledRaw } from "@/engine/sessionSettings";
import { setReadOnlyState } from "@/engine/displayGlobals";
import { toothState } from "@/state/chart";

describe("tileOverlays module", () => {
  let controlsActionsEl: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    setSelectedTeeth([]);
    setActiveTooth(null);
    setNotesEnabledRaw(true);
    setReadOnlyState(false);
    toothState.clear();

    controlsActionsEl = document.createElement("div");
    controlsActionsEl.id = "controlsActions";
    controlsActionsEl.scrollIntoView = vi.fn();
    document.body.appendChild(controlsActionsEl);
  });

  afterEach(() => {
    hideZoomPopover();
    hideContextMenu();
    hideNoteEditor();
  });

  describe("A. showZoomPopover root resolution & rendering", () => {
    it("is a no-op when roots is undefined or empty", () => {
      const deps: ZoomPopoverDeps = {
        roots: undefined,
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      };
      showZoomPopover(11, deps);
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();

      deps.roots = [];
      showZoomPopover(11, deps);
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
    });

    it("renders popover with single root and clones SVG", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("id", "tooth-11-svg");
      tile.appendChild(svg);
      document.body.appendChild(tile);

      const deps: ZoomPopoverDeps = {
        roots: [svg],
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      };

      showZoomPopover(11, deps);

      const overlay = document.querySelector(".odon-zoom-overlay");
      expect(overlay).not.toBeNull();
      const popover = document.querySelector(".odon-zoom-popover");
      expect(popover).not.toBeNull();
      expect(popover?.querySelector(".odon-zoom-title")?.textContent).toContain("11");

      const clonedSvg = popover?.querySelector(".odon-zoom-svg svg");
      expect(clonedSvg).not.toBeNull();
      expect(clonedSvg?.getAttribute("id")).toBe("tooth-11-svg");
    });

    it("selects visible side-view SVG among permanent and deciduous variants", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view";
      const permSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      permSvg.setAttribute("id", "perm-svg");
      permSvg.style.display = "none";

      const primSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      primSvg.setAttribute("id", "prim-svg");
      primSvg.style.display = "";

      tile.appendChild(permSvg);
      tile.appendChild(primSvg);
      document.body.appendChild(tile);

      const deps: ZoomPopoverDeps = {
        roots: [permSvg, primSvg],
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      };

      showZoomPopover(51, deps);

      const clonedSvg = document.querySelector(".odon-zoom-svg svg");
      expect(clonedSvg?.getAttribute("id")).toBe("prim-svg");
    });

    it("falls back to roots[0] if no visible side-view tile is found", () => {
      const fallbackSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      fallbackSvg.setAttribute("id", "fallback-svg");

      const deps: ZoomPopoverDeps = {
        roots: [fallbackSvg],
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      };

      showZoomPopover(16, deps);

      const clonedSvg = document.querySelector(".odon-zoom-svg svg");
      expect(clonedSvg?.getAttribute("id")).toBe("fallback-svg");
    });
  });

  describe("B. Zoom Popover Actions", () => {
    function setupTooth(_toothNo: number) {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      tile.appendChild(svg);
      document.body.appendChild(tile);
      return [svg];
    }

    it("handles select button on unselected tooth", () => {
      const roots = setupTooth(21);
      const updateSelectionUI = vi.fn();
      const deps: ZoomPopoverDeps = {
        roots,
        updateSelectionUI,
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      };

      showZoomPopover(21, deps);
      const selectBtn = document.querySelectorAll<HTMLButtonElement>(".odon-zoom-btn")[0];
      expect(selectBtn.classList.contains("active")).toBe(false);

      selectBtn.click();

      expect(selectedTeeth.has(21)).toBe(true);
      expect(activeTooth).toBe(21);
      expect(updateSelectionUI).toHaveBeenCalledTimes(1);
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
    });

    it("handles deselect button on already-selected active tooth", () => {
      const roots = setupTooth(21);
      setSelectedTeeth([21, 22]);
      setActiveTooth(21);

      const updateSelectionUI = vi.fn();
      const deps: ZoomPopoverDeps = {
        roots,
        updateSelectionUI,
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      };

      showZoomPopover(21, deps);
      const selectBtn = document.querySelectorAll<HTMLButtonElement>(".odon-zoom-btn")[0];
      expect(selectBtn.classList.contains("active")).toBe(true);

      selectBtn.click();

      expect(selectedTeeth.has(21)).toBe(false);
      expect(activeTooth).toBe(22); // next available in selection
      expect(updateSelectionUI).toHaveBeenCalledTimes(1);
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
    });

    it("handles info button: selects single tooth and scrolls controls panel", () => {
      const roots = setupTooth(14);
      setSelectedTeeth([11, 12]);
      setActiveTooth(11);

      const updateSelectionUI = vi.fn();
      const deps: ZoomPopoverDeps = {
        roots,
        updateSelectionUI,
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      };

      showZoomPopover(14, deps);
      const infoBtn = document.querySelectorAll<HTMLButtonElement>(".odon-zoom-btn")[1];
      infoBtn.click();

      expect(selectedTeeth.size).toBe(1);
      expect(selectedTeeth.has(14)).toBe(true);
      expect(activeTooth).toBe(14);
      expect(updateSelectionUI).toHaveBeenCalledTimes(1);
      expect(controlsActionsEl.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
    });

    it("handles reset button: invokes resetToothGated and closes popover", () => {
      const roots = setupTooth(36);
      const resetToothGated = vi.fn();
      const deps: ZoomPopoverDeps = {
        roots,
        updateSelectionUI: vi.fn(),
        resetToothGated,
        showNoteEditor: vi.fn(),
      };

      showZoomPopover(36, deps);
      const resetBtn = document.querySelector<HTMLButtonElement>(".odon-zoom-btn.danger");
      expect(resetBtn).not.toBeNull();
      resetBtn?.click();

      expect(resetToothGated).toHaveBeenCalledWith(36);
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
    });

    it("handles note button: launches note editor and closes popover", () => {
      const roots = setupTooth(46);
      const showNoteEditor = vi.fn();
      const deps: ZoomPopoverDeps = {
        roots,
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor,
      };

      showZoomPopover(46, deps);
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>(".odon-zoom-btn"));
      const noteBtn = buttons.find((b) => b.textContent?.includes("Megjegyzés") || b.textContent?.includes("Note"));
      expect(noteBtn).toBeDefined();

      noteBtn?.click();

      expect(showNoteEditor).toHaveBeenCalledWith(46);
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
    });

    it("omits note button when readOnly is true or notesEnabled is false", () => {
      const roots = setupTooth(46);
      setReadOnlyState(true);

      showZoomPopover(46, {
        roots,
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      });

      const buttonsReadOnly = Array.from(document.querySelectorAll<HTMLButtonElement>(".odon-zoom-btn"));
      const noteBtnReadOnly = buttonsReadOnly.find((b) => b.textContent?.includes("Note") || b.textContent?.includes("Megjegyzés"));
      expect(noteBtnReadOnly).toBeUndefined();

      hideZoomPopover();
      setReadOnlyState(false);
      setNotesEnabledRaw(false);

      showZoomPopover(46, {
        roots,
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      });

      const buttonsNotesOff = Array.from(document.querySelectorAll<HTMLButtonElement>(".odon-zoom-btn"));
      const noteBtnNotesOff = buttonsNotesOff.find((b) => b.textContent?.includes("Note") || b.textContent?.includes("Megjegyzés"));
      expect(noteBtnNotesOff).toBeUndefined();
    });

    it("closes on close button click and on backdrop click", () => {
      const roots = setupTooth(11);
      showZoomPopover(11, {
        roots,
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      });

      const closeBtn = document.querySelector<HTMLButtonElement>(".odon-zoom-close");
      expect(closeBtn).not.toBeNull();
      closeBtn?.click();
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();

      showZoomPopover(11, {
        roots,
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      });
      const overlay = document.querySelector(".odon-zoom-overlay") as HTMLElement;
      overlay.click();
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
    });
  });

  describe("C. showContextMenu & Context Menu Actions", () => {
    it("renders select item on unselected tooth; clicking selects tooth", () => {
      const updateSelectionUI = vi.fn();
      const deps: ContextMenuDeps = {
        updateSelectionUI,
        resetToothGated: vi.fn(),
      };

      showContextMenu(15, { clientX: 100, clientY: 200 }, deps);

      const menu = document.querySelector(".odon-ctx-menu") as HTMLElement;
      expect(menu).not.toBeNull();
      expect(menu.style.left).toBe("100px");
      expect(menu.style.top).toBe("190px"); // clientY - 10

      const items = menu.querySelectorAll<HTMLButtonElement>(".odon-ctx-item");
      expect(items.length).toBe(2); // Select, Reset
      items[0].click();

      expect(selectedTeeth.size).toBe(1);
      expect(selectedTeeth.has(15)).toBe(true);
      expect(activeTooth).toBe(15);
      expect(updateSelectionUI).toHaveBeenCalledTimes(1);
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
    });

    it("renders deselect item on selected tooth; clicking deselects tooth", () => {
      setSelectedTeeth([15, 16]);
      setActiveTooth(15);

      const updateSelectionUI = vi.fn();
      const deps: ContextMenuDeps = {
        updateSelectionUI,
        resetToothGated: vi.fn(),
      };

      showContextMenu(15, { clientX: 50, clientY: 50 }, deps);

      const menu = document.querySelector(".odon-ctx-menu") as HTMLElement;
      const items = menu.querySelectorAll<HTMLButtonElement>(".odon-ctx-item");
      expect(items.length).toBe(2); // Deselect, Reset
      items[0].click();

      expect(selectedTeeth.has(15)).toBe(false);
      expect(activeTooth).toBe(16);
      expect(updateSelectionUI).toHaveBeenCalledTimes(1);
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
    });

    it("renders multi-select item when other teeth are already selected", () => {
      setSelectedTeeth([11]);
      setActiveTooth(11);

      const updateSelectionUI = vi.fn();
      const deps: ContextMenuDeps = {
        updateSelectionUI,
        resetToothGated: vi.fn(),
      };

      showContextMenu(12, { clientX: 50, clientY: 50 }, deps);

      const menu = document.querySelector(".odon-ctx-menu") as HTMLElement;
      const items = menu.querySelectorAll<HTMLButtonElement>(".odon-ctx-item");
      expect(items.length).toBe(3); // Select, Multi-select, Reset

      // Click multi-select item (index 1)
      items[1].click();

      expect(selectedTeeth.has(11)).toBe(true);
      expect(selectedTeeth.has(12)).toBe(true);
      expect(activeTooth).toBe(12);
      expect(updateSelectionUI).toHaveBeenCalledTimes(1);
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
    });

    it("handles reset button: invokes resetToothGated and closes context menu", () => {
      const resetToothGated = vi.fn();
      showContextMenu(24, { clientX: 100, clientY: 100 }, {
        updateSelectionUI: vi.fn(),
        resetToothGated,
      });

      const resetItem = document.querySelector<HTMLButtonElement>(".odon-ctx-item.danger");
      expect(resetItem).not.toBeNull();
      resetItem?.click();

      expect(resetToothGated).toHaveBeenCalledWith(24);
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
    });

    it("clamps context menu coordinates within viewport bounds", () => {
      // Mock window inner width & height
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(800);
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(600);

      showContextMenu(11, { clientX: 750, clientY: 550 }, {
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
      });

      const menu = document.querySelector(".odon-ctx-menu") as HTMLElement;
      expect(menu.style.left).toBe("600px"); // 800 - 200
      expect(menu.style.top).toBe("400px"); // 600 - 200
    });

    it("registers outside click handler after 50ms and dismisses on outside click", async () => {
      vi.useFakeTimers();

      showContextMenu(11, { clientX: 100, clientY: 100 }, {
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
      });

      const menu = document.querySelector(".odon-ctx-menu") as HTMLElement;
      expect(menu).not.toBeNull();

      // Before 50ms: outside click does not close menu yet
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(document.querySelector(".odon-ctx-menu")).not.toBeNull();

      // Advance 50ms
      vi.advanceTimersByTime(50);

      // Outside click now dismisses
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("D. Mutual exclusion & teardown", () => {
    it("opening zoom popover closes any existing context menu and previous zoom popover", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      tile.appendChild(svg);
      document.body.appendChild(tile);

      showContextMenu(11, { clientX: 50, clientY: 50 }, {
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
      });
      expect(document.querySelector(".odon-ctx-menu")).not.toBeNull();

      showZoomPopover(11, {
        roots: [svg],
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      });
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
      expect(document.querySelector(".odon-zoom-overlay")).not.toBeNull();
    });

    it("opening context menu closes any existing zoom popover", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      tile.appendChild(svg);
      document.body.appendChild(tile);

      showZoomPopover(11, {
        roots: [svg],
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      });
      expect(document.querySelector(".odon-zoom-overlay")).not.toBeNull();

      showContextMenu(11, { clientX: 50, clientY: 50 }, {
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
      });
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();
      expect(document.querySelector(".odon-ctx-menu")).not.toBeNull();
    });

    it("hideZoomPopover and hideContextMenu cleanly remove elements during teardown", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile side-view";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      tile.appendChild(svg);
      document.body.appendChild(tile);

      showZoomPopover(11, {
        roots: [svg],
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
        showNoteEditor: vi.fn(),
      });
      expect(document.querySelector(".odon-zoom-overlay")).not.toBeNull();
      hideZoomPopover();
      expect(document.querySelector(".odon-zoom-overlay")).toBeNull();

      showContextMenu(11, { clientX: 50, clientY: 50 }, {
        updateSelectionUI: vi.fn(),
        resetToothGated: vi.fn(),
      });
      expect(document.querySelector(".odon-ctx-menu")).not.toBeNull();
      hideContextMenu();
      expect(document.querySelector(".odon-ctx-menu")).toBeNull();
    });
  });

  describe("E. showNoteEditor & hideNoteEditor behavior", () => {
    function createMockDeps(overrides?: Partial<NoteEditorDeps>): NoteEditorDeps {
      return {
        tiles: undefined,
        updateToothTooltip: vi.fn(),
        updateToothLabelNoteIcon: vi.fn(),
        notifyStateChange: vi.fn(),
        state: { note: "" },
        ...overrides,
      };
    }

    it("respects notesEnabled and readOnly flags", () => {
      const deps = createMockDeps();

      setNotesEnabledRaw(false);
      showNoteEditor(11, deps);
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();

      setNotesEnabledRaw(true);
      setReadOnlyState(true);
      showNoteEditor(11, deps);
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();

      setReadOnlyState(false);
      showNoteEditor(11, deps);
      expect(document.querySelector(".odon-note-backdrop")).not.toBeNull();
    });

    it("returns gracefully when tooth has no state", () => {
      const deps = createMockDeps({ state: undefined });
      showNoteEditor(99, deps); // toothState is empty
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
    });

    it("reads state from toothState when deps.state is omitted", () => {
      toothState.set(21, { note: "existing chart note" });
      const deps = createMockDeps({ state: undefined });
      showNoteEditor(21, deps);

      const popover = document.querySelector(".odon-note-popover");
      expect(popover).not.toBeNull();
      const textarea = popover?.querySelector<HTMLTextAreaElement>(".odon-note-textarea");
      expect(textarea?.value).toBe("existing chart note");
    });

    it("renders complete DOM structure with header, textarea, and action buttons", () => {
      const deps = createMockDeps({ state: { note: "initial" } });
      showNoteEditor(16, deps);

      const backdrop = document.querySelector(".odon-note-backdrop");
      expect(backdrop).not.toBeNull();

      const popover = backdrop?.querySelector(".odon-note-popover");
      expect(popover).not.toBeNull();

      const header = popover?.querySelector(".odon-note-header");
      expect(header).not.toBeNull();
      expect(header?.querySelector(".odon-note-title")).not.toBeNull();
      expect(header?.querySelector(".odon-zoom-close")?.textContent).toBe("✕");

      const textarea = popover?.querySelector<HTMLTextAreaElement>(".odon-note-textarea");
      expect(textarea).not.toBeNull();
      expect(textarea?.rows).toBe(3);
      expect(textarea?.placeholder).toBeTruthy();
      expect(textarea?.value).toBe("initial");

      const actions = popover?.querySelector(".odon-note-actions");
      expect(actions).not.toBeNull();
      const buttons = actions?.querySelectorAll<HTMLButtonElement>("button");
      expect(buttons?.length).toBe(2);
      expect(buttons?.[0]?.className).toBe("odon-zoom-btn");
      expect(buttons?.[1]?.className).toBe("odon-zoom-btn danger");
    });

    it("focuses textarea upon mounting", () => {
      const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, "focus");
      const deps = createMockDeps();
      showNoteEditor(11, deps);
      expect(focusSpy).toHaveBeenCalled();
      focusSpy.mockRestore();
    });

    it("positions relative to side-view tile when multiple tiles exist", () => {
      const occlusalTile = document.createElement("div");
      occlusalTile.className = "tooth-tile occlusal-view";
      occlusalTile.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 100, top: 100, right: 150, bottom: 150, width: 50, height: 50,
      });

      const sideTile = document.createElement("div");
      sideTile.className = "tooth-tile side-view";
      sideTile.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 200, top: 200, right: 260, bottom: 260, width: 60, height: 60,
      });

      const deps = createMockDeps({ tiles: [occlusalTile, sideTile] });
      showNoteEditor(11, deps);

      const popover = document.querySelector<HTMLElement>(".odon-note-popover");
      expect(popover?.style.position).toBe("fixed");
      // left = 200 + 30 - 160 = 70px
      expect(popover?.style.left).toBe("70px");
      // top = 260 + 8 = 268px
      expect(popover?.style.top).toBe("268px");
    });

    it("falls back to first tile when no side-view class is present", () => {
      const tile = document.createElement("div");
      tile.className = "tooth-tile custom-view";
      tile.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 300, top: 100, right: 350, bottom: 150, width: 50, height: 50,
      });

      const deps = createMockDeps({ tiles: [tile] });
      showNoteEditor(11, deps);

      const popover = document.querySelector<HTMLElement>(".odon-note-popover");
      // left = 300 + 25 - 160 = 165px
      expect(popover?.style.left).toBe("165px");
      expect(popover?.style.top).toBe("158px");
    });

    it("handles missing anchor tile without throwing or positioning", () => {
      const deps = createMockDeps({ tiles: [] });
      expect(() => showNoteEditor(11, deps)).not.toThrow();
      const popover = document.querySelector<HTMLElement>(".odon-note-popover");
      expect(popover).not.toBeNull();
      expect(popover?.style.position).toBe("");
    });

    it("clamps positioning to viewport horizontally and vertically", () => {
      // Left overflow clamp (< 8)
      const leftTile = document.createElement("div");
      leftTile.className = "tooth-tile side-view";
      leftTile.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 10, top: 50, right: 30, bottom: 70, width: 20, height: 20,
      });
      showNoteEditor(11, createMockDeps({ tiles: [leftTile] }));
      let popover = document.querySelector<HTMLElement>(".odon-note-popover");
      expect(popover?.style.left).toBe("8px");

      // Right overflow clamp
      const rightTile = document.createElement("div");
      rightTile.className = "tooth-tile side-view";
      rightTile.getBoundingClientRect = vi.fn().mockReturnValue({
        left: window.innerWidth - 50, top: 50, right: window.innerWidth - 10, bottom: 70, width: 40, height: 20,
      });
      showNoteEditor(12, createMockDeps({ tiles: [rightTile] }));
      popover = document.querySelector<HTMLElement>(".odon-note-popover");
      expect(popover?.style.left).toBe(`${window.innerWidth - 320 - 8}px`);

      // Bottom overflow flips above anchor
      const bottomTile = document.createElement("div");
      bottomTile.className = "tooth-tile side-view";
      bottomTile.getBoundingClientRect = vi.fn().mockReturnValue({
        left: 200, top: window.innerHeight - 50, right: 240, bottom: window.innerHeight - 10, width: 40, height: 40,
      });
      showNoteEditor(13, createMockDeps({ tiles: [bottomTile] }));
      popover = document.querySelector<HTMLElement>(".odon-note-popover");
      expect(popover?.style.top).toBe(`${window.innerHeight - 50 - 208}px`);
    });

    it("closes when backdrop is clicked, but stays open when popover itself is clicked", () => {
      const deps = createMockDeps();
      showNoteEditor(11, deps);

      const popover = document.querySelector(".odon-note-popover");
      const backdrop = document.querySelector(".odon-note-backdrop");
      expect(backdrop).not.toBeNull();

      // Click inside popover -> stops propagation, remains mounted
      popover?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(document.querySelector(".odon-note-backdrop")).not.toBeNull();

      // Click backdrop -> closes
      backdrop?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
    });

    it("closes when close button (✕) is clicked", () => {
      const deps = createMockDeps();
      showNoteEditor(11, deps);
      const closeBtn = document.querySelector<HTMLButtonElement>(".odon-zoom-close");
      closeBtn?.click();
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
    });

    it("commitNote on Save trims value, updates UI, dismisses popup, and notifies when changed", () => {
      const stateObj = { note: "initial" };
      const deps = createMockDeps({ state: stateObj });
      showNoteEditor(11, deps);

      const textarea = document.querySelector<HTMLTextAreaElement>(".odon-note-textarea");
      if (textarea) textarea.value = "   updated text with spaces   ";

      const saveBtn = document.querySelector<HTMLButtonElement>(".odon-note-actions button:not(.danger)");
      saveBtn?.click();

      expect(stateObj.note).toBe("updated text with spaces");
      expect(deps.updateToothTooltip).toHaveBeenCalledWith(11);
      expect(deps.updateToothLabelNoteIcon).toHaveBeenCalledWith(11);
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
      expect(deps.notifyStateChange).toHaveBeenCalledTimes(1);
    });

    it("commitNote on Save does not notify when trimmed text equals existing note", () => {
      const stateObj = { note: "same note" };
      const deps = createMockDeps({ state: stateObj });
      showNoteEditor(11, deps);

      const textarea = document.querySelector<HTMLTextAreaElement>(".odon-note-textarea");
      if (textarea) textarea.value = "  same note  ";

      const saveBtn = document.querySelector<HTMLButtonElement>(".odon-note-actions button:not(.danger)");
      saveBtn?.click();

      expect(stateObj.note).toBe("same note");
      expect(deps.updateToothTooltip).toHaveBeenCalledWith(11);
      expect(deps.updateToothLabelNoteIcon).toHaveBeenCalledWith(11);
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
      expect(deps.notifyStateChange).not.toHaveBeenCalled();
    });

    it("commitNote on Delete sets note to empty string and notifies when note was non-empty", () => {
      const stateObj = { note: "to delete" };
      const deps = createMockDeps({ state: stateObj });
      showNoteEditor(11, deps);

      const deleteBtn = document.querySelector<HTMLButtonElement>(".odon-note-actions button.danger");
      deleteBtn?.click();

      expect(stateObj.note).toBe("");
      expect(deps.updateToothTooltip).toHaveBeenCalledWith(11);
      expect(deps.updateToothLabelNoteIcon).toHaveBeenCalledWith(11);
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
      expect(deps.notifyStateChange).toHaveBeenCalledTimes(1);
    });

    it("commitNote on Delete does not notify when note was already empty", () => {
      const stateObj = { note: "" };
      const deps = createMockDeps({ state: stateObj });
      showNoteEditor(11, deps);

      const deleteBtn = document.querySelector<HTMLButtonElement>(".odon-note-actions button.danger");
      deleteBtn?.click();

      expect(stateObj.note).toBe("");
      expect(deps.updateToothTooltip).toHaveBeenCalledWith(11);
      expect(deps.updateToothLabelNoteIcon).toHaveBeenCalledWith(11);
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
      expect(deps.notifyStateChange).not.toHaveBeenCalled();
    });

    it("preserves state-object identity captured at creation time", () => {
      const stateObj = { note: "first" };
      const deps = createMockDeps({ state: stateObj });
      showNoteEditor(11, deps);

      // Mutate external state before clicking Save
      stateObj.note = "mutated-outside";

      const textarea = document.querySelector<HTMLTextAreaElement>(".odon-note-textarea");
      if (textarea) textarea.value = "saved-via-editor";

      const saveBtn = document.querySelector<HTMLButtonElement>(".odon-note-actions button:not(.danger)");
      saveBtn?.click();

      expect(stateObj.note).toBe("saved-via-editor");
    });

    it("calling showNoteEditor repeatedly cleans up prior backdrop before mounting new one", () => {
      const deps1 = createMockDeps({ state: { note: "note 1" } });
      const deps2 = createMockDeps({ state: { note: "note 2" } });

      showNoteEditor(11, deps1);
      expect(document.querySelectorAll(".odon-note-backdrop").length).toBe(1);

      showNoteEditor(12, deps2);
      expect(document.querySelectorAll(".odon-note-backdrop").length).toBe(1);
      expect(document.querySelector<HTMLTextAreaElement>(".odon-note-textarea")?.value).toBe("note 2");
    });

    it("hideNoteEditor cleanly removes backdrop during teardown", () => {
      showNoteEditor(11, createMockDeps());
      expect(document.querySelector(".odon-note-backdrop")).not.toBeNull();
      hideNoteEditor();
      expect(document.querySelector(".odon-note-backdrop")).toBeNull();
    });
  });
});

