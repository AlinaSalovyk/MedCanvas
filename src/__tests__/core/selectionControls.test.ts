import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import {
  bindSelectionControls,
  updateActiveLabel,
  updateSelectionFilterButtons,
} from "@/engine/controls/selectionControls";
import {
  selectedTeeth,
  activeTooth,
  setSelectedTeeth,
  setActiveTooth,
} from "@/engine/selection";
import { ALL_TEETH } from "@/anatomy/profiles";
import { charts, toothState, setActiveChartMode } from "@/state/chart";
import { defaultState } from "@/state/payload";
import { setI18nLanguage } from "@/i18n/useI18n";

function setupButtonsDOM(): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = `
    <span id="activeToothLabel">—</span>
    <button id="btnSelectAll">All</button>
    <button id="btnSelectAllPresent">Present</button>
    <button id="btnSelectPermanent">Permanent</button>
    <button id="btnSelectMilk">Milk</button>
    <button id="btnSelectImplants">Implants</button>
    <button id="btnSelectAllMissing">Missing</button>
    <button id="btnSelectUpper">Upper</button>
    <button id="btnSelectUpperFront">Upper Front</button>
    <button id="btnSelectUpperMolar">Upper Molar</button>
    <button id="btnSelectLower">Lower</button>
    <button id="btnSelectLowerFront">Lower Front</button>
    <button id="btnSelectLowerMolar">Lower Molar</button>
    <button id="btnSelectNone">Clear</button>
    <button id="btnSelectNoneChart">Clear Chart</button>
  `;
  document.body.appendChild(container);
  return container;
}

describe("selectionControls module", () => {
  let updateVisibilitySpy: Mock<() => void>;
  let updateUiSpy: Mock<() => void>;

  const makeDeps = (customBindOnce?: (el: Element | null | undefined, type: string, handler: (e: Event) => void) => void) => ({
    ...(customBindOnce ? { bindOnce: customBindOnce } : {}),
    updateToothTileVisibility: () => updateVisibilitySpy(),
    updateSelectionUI: () => updateUiSpy(),
  });

  beforeEach(() => {
    document.body.innerHTML = "";
    setupButtonsDOM();
    setI18nLanguage("en");
    setActiveChartMode("status");

    // Initialize state with default sound teeth
    charts.status.clear();
    charts.plan.clear();
    for (const tn of ALL_TEETH) {
      charts.status.set(tn, defaultState());
      charts.plan.set(tn, defaultState());
    }

    setSelectedTeeth(new Set());
    setActiveTooth(null);

    updateVisibilitySpy = vi.fn<() => void>();
    updateUiSpy = vi.fn<() => void>();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    setSelectedTeeth(new Set());
    setActiveTooth(null);
  });

  // ---------------------------------------------------------------------------
  // 1. Select All
  // ---------------------------------------------------------------------------
  it("Select All: selects all teeth in ALL_TEETH, sets active tooth to 18, calls updateToothTileVisibility", () => {
    bindSelectionControls(makeDeps());

    const btn = document.getElementById("btnSelectAll")!;
    btn.click();

    expect(selectedTeeth.size).toBe(ALL_TEETH.length);
    expect(Array.from(selectedTeeth)).toEqual(ALL_TEETH);
    expect(activeTooth).toBe(18);
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);
    expect(updateUiSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 2. Select Present & 3. Select Missing
  // ---------------------------------------------------------------------------
  it("Select Present & Select Missing: correctly filters according to toothSelection", () => {
    // Mark tooth 11, 12, 13 as missing ("none")
    toothState.get(11)!.toothSelection = "none";
    toothState.get(12)!.toothSelection = "none";
    toothState.get(13)!.toothSelection = "none";

    bindSelectionControls(makeDeps());

    // Test Select Missing
    const btnMissing = document.getElementById("btnSelectAllMissing")!;
    btnMissing.click();

    expect(Array.from(selectedTeeth)).toEqual([13, 12, 11]);
    expect(activeTooth).toBe(13); // first matching in ALL_TEETH order
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);

    // Test Select Present
    const btnPresent = document.getElementById("btnSelectAllPresent")!;
    btnPresent.click();

    const expectedPresent = ALL_TEETH.filter((tn) => tn !== 11 && tn !== 12 && tn !== 13);
    expect(Array.from(selectedTeeth)).toEqual(expectedPresent);
    expect(activeTooth).toBe(expectedPresent[0]);
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // 4. Select Permanent
  // ---------------------------------------------------------------------------
  it("Select Permanent: filters teeth where toothSelection is 'tooth-base'", () => {
    // Make 21 milk tooth, 22 implant
    toothState.get(21)!.toothSelection = "milktooth";
    toothState.get(22)!.toothSelection = "implant";

    bindSelectionControls(makeDeps());

    const btn = document.getElementById("btnSelectPermanent")!;
    btn.click();

    const expected = ALL_TEETH.filter((tn) => tn !== 21 && tn !== 22);
    expect(Array.from(selectedTeeth)).toEqual(expected);
    expect(activeTooth).toBe(18);
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 5. Select Primary/Milk
  // ---------------------------------------------------------------------------
  it("Select Milk: filters teeth where toothSelection is 'milktooth'", () => {
    toothState.get(16)!.toothSelection = "milktooth";
    toothState.get(26)!.toothSelection = "milktooth";

    bindSelectionControls(makeDeps());

    const btn = document.getElementById("btnSelectMilk")!;
    btn.click();

    expect(Array.from(selectedTeeth)).toEqual([16, 26]);
    expect(activeTooth).toBe(16);
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 6. Select Implants
  // ---------------------------------------------------------------------------
  it("Select Implants: filters teeth where toothSelection is 'implant'", () => {
    toothState.get(16)!.toothSelection = "implant";
    toothState.get(26)!.toothSelection = "implant";

    bindSelectionControls(makeDeps());

    const btn = document.getElementById("btnSelectImplants")!;
    btn.click();

    expect(Array.from(selectedTeeth)).toEqual([16, 26]);
    expect(activeTooth).toBe(16);
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 7. Upper / Lower arch selection
  // ---------------------------------------------------------------------------
  it("Upper and Lower: sets respective teeth and active tooth (11 for Upper, 31 for Lower)", () => {
    bindSelectionControls(makeDeps());

    const btnUpper = document.getElementById("btnSelectUpper")!;
    btnUpper.click();

    const upperTeeth = ALL_TEETH.filter((tn) => tn >= 11 && tn <= 28);
    expect(Array.from(selectedTeeth)).toEqual(upperTeeth);
    expect(activeTooth).toBe(11); // Legacy invariant: upper always sets active 11
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);

    const btnLower = document.getElementById("btnSelectLower")!;
    btnLower.click();

    const lowerTeeth = ALL_TEETH.filter((tn) => tn >= 31 && tn <= 48);
    expect(Array.from(selectedTeeth)).toEqual(lowerTeeth);
    expect(activeTooth).toBe(31); // Legacy invariant: lower always sets active 31
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // 8. Front and Molar segments
  // ---------------------------------------------------------------------------
  it("Front and Molar segments: select exact anatomical subgroups and anchor active tooth", () => {
    bindSelectionControls(makeDeps());

    // Upper Front: [13, 12, 11, 21, 22, 23], active: 13
    document.getElementById("btnSelectUpperFront")!.click();
    expect(Array.from(selectedTeeth)).toEqual([13, 12, 11, 21, 22, 23]);
    expect(activeTooth).toBe(13);

    // Upper Molar: [18, 17, 16, 26, 27, 28], active: 18
    document.getElementById("btnSelectUpperMolar")!.click();
    expect(Array.from(selectedTeeth)).toEqual([18, 17, 16, 26, 27, 28]);
    expect(activeTooth).toBe(18);

    // Lower Front: [43, 42, 41, 31, 32, 33], active: 43
    document.getElementById("btnSelectLowerFront")!.click();
    expect(Array.from(selectedTeeth)).toEqual([43, 42, 41, 31, 32, 33]);
    expect(activeTooth).toBe(43);

    // Lower Molar: [38, 37, 36, 46, 47, 48], active: 38
    document.getElementById("btnSelectLowerMolar")!.click();
    expect(Array.from(selectedTeeth)).toEqual([38, 37, 36, 46, 47, 48]);
    expect(activeTooth).toBe(38);
  });

  // ---------------------------------------------------------------------------
  // 9. Empty filter results
  // ---------------------------------------------------------------------------
  it("Empty filter result: sets empty selection and null active tooth without throwing", () => {
    // All teeth are "tooth-base", so none are "implant"
    bindSelectionControls(makeDeps());

    const btn = document.getElementById("btnSelectImplants")!;
    btn.click();

    expect(selectedTeeth.size).toBe(0);
    expect(activeTooth).toBeNull();
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 10. Both Clear Selection buttons
  // ---------------------------------------------------------------------------
  it("Both Clear Selection buttons: clear selection, set active tooth to null, call updateSelectionUI", () => {
    setSelectedTeeth(new Set([11, 12]));
    setActiveTooth(11);

    bindSelectionControls(makeDeps());

    const btnNone = document.getElementById("btnSelectNone")!;
    btnNone.click();

    expect(selectedTeeth.size).toBe(0);
    expect(activeTooth).toBeNull();
    expect(updateUiSpy).toHaveBeenCalledTimes(1);
    expect(updateVisibilitySpy).not.toHaveBeenCalled();

    // Re-select and test btnSelectNoneChart
    setSelectedTeeth(new Set([21]));
    setActiveTooth(21);

    const btnNoneChart = document.getElementById("btnSelectNoneChart")!;
    btnNoneChart.click();

    expect(selectedTeeth.size).toBe(0);
    expect(activeTooth).toBeNull();
    expect(updateUiSpy).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // 11 & 12. Active tooth assignment and selection ordering
  // ---------------------------------------------------------------------------
  it("Selection ordering: preserves insertion order matching ALL_TEETH or preset sequence", () => {
    bindSelectionControls(makeDeps());

    document.getElementById("btnSelectUpperFront")!.click();
    const arr = Array.from(selectedTeeth);
    expect(arr).toEqual([13, 12, 11, 21, 22, 23]);
  });

  // ---------------------------------------------------------------------------
  // 13. Status vs Plan mode live binding
  // ---------------------------------------------------------------------------
  it("Status/Plan mode reads: filters operate on the currently active chart", () => {
    // In Status mode, tooth 11 is "tooth-base"
    // In Plan mode, tooth 11 is "implant"
    charts.plan.get(11)!.toothSelection = "implant";

    bindSelectionControls(makeDeps());

    // In Status mode, no implants
    document.getElementById("btnSelectImplants")!.click();
    expect(selectedTeeth.size).toBe(0);

    // Switch to Plan mode
    setActiveChartMode("plan");

    // In Plan mode, tooth 11 is selected
    document.getElementById("btnSelectImplants")!.click();
    expect(Array.from(selectedTeeth)).toEqual([11]);
    expect(activeTooth).toBe(11);
  });

  // ---------------------------------------------------------------------------
  // 14. Repeated control binding (idempotency via bindOnce)
  // ---------------------------------------------------------------------------
  it("Repeated control binding: bindOnce prevents duplicate listener execution", () => {
    const wired = new WeakMap<Element, Set<string>>();
    const customBindOnce = (el: Element | null | undefined, type: string, handler: (e: Event) => void) => {
      if (!el) return;
      let set = wired.get(el);
      if (!set) {
        set = new Set();
        wired.set(el, set);
      }
      if (set.has(type)) return;
      set.add(type);
      el.addEventListener(type, handler);
    };

    const deps = makeDeps(customBindOnce);

    // Call bindSelectionControls multiple times
    bindSelectionControls(deps);
    bindSelectionControls(deps);
    bindSelectionControls(deps);

    document.getElementById("btnSelectAll")!.click();

    // Despite 3 calls to bindSelectionControls, updateToothTileVisibility should run ONCE
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 15. React remount / replacement DOM elements
  // ---------------------------------------------------------------------------
  it("React remount: binds fresh replacement DOM elements cleanly", () => {
    const wired = new WeakMap<Element, Set<string>>();
    const customBindOnce = (el: Element | null | undefined, type: string, handler: (e: Event) => void) => {
      if (!el) return;
      let set = wired.get(el);
      if (!set) {
        set = new Set();
        wired.set(el, set);
      }
      if (set.has(type)) return;
      set.add(type);
      el.addEventListener(type, handler);
    };

    const deps = makeDeps(customBindOnce);

    bindSelectionControls(deps);

    // Simulate surface remount: replace container with new DOM nodes
    document.body.innerHTML = "";
    setupButtonsDOM();

    // Re-wire new nodes
    bindSelectionControls(deps);

    document.getElementById("btnSelectAll")!.click();
    expect(selectedTeeth.size).toBe(ALL_TEETH.length);
    expect(updateVisibilitySpy).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Secondary Helpers: updateActiveLabel & updateSelectionFilterButtons
  // ---------------------------------------------------------------------------
  describe("updateActiveLabel presentation helper", () => {
    it("renders '—' when no teeth are selected", () => {
      setSelectedTeeth(new Set());
      setActiveTooth(null);
      updateActiveLabel();
      expect(document.getElementById("activeToothLabel")?.textContent).toBe("—");
    });

    it("renders single tooth number when exactly one tooth is selected", () => {
      setSelectedTeeth(new Set([11]));
      setActiveTooth(11);
      updateActiveLabel();
      expect(document.getElementById("activeToothLabel")?.textContent).toBe("11");
    });

    it("renders count text when multiple teeth are selected", () => {
      setSelectedTeeth(new Set([11, 21]));
      setActiveTooth(11);
      updateActiveLabel();
      expect(document.getElementById("activeToothLabel")?.textContent).toBe("2 teeth");
    });
  });

  describe("updateSelectionFilterButtons visibility helper", () => {
    it("toggles .is-hidden classes based on presence of statuses across teeth", () => {
      // Default: all teeth are tooth-base (present, permanent)
      updateSelectionFilterButtons();
      expect(document.getElementById("btnSelectAllPresent")?.classList.contains("is-hidden")).toBe(false);
      expect(document.getElementById("btnSelectPermanent")?.classList.contains("is-hidden")).toBe(false);
      expect(document.getElementById("btnSelectAllMissing")?.classList.contains("is-hidden")).toBe(true);
      expect(document.getElementById("btnSelectMilk")?.classList.contains("is-hidden")).toBe(true);
      expect(document.getElementById("btnSelectImplants")?.classList.contains("is-hidden")).toBe(true);

      // Add a missing tooth, a milk tooth, and an implant
      toothState.get(11)!.toothSelection = "none";
      toothState.get(16)!.toothSelection = "milktooth";
      toothState.get(46)!.toothSelection = "implant";

      updateSelectionFilterButtons();
      expect(document.getElementById("btnSelectAllMissing")?.classList.contains("is-hidden")).toBe(false);
      expect(document.getElementById("btnSelectMilk")?.classList.contains("is-hidden")).toBe(false);
      expect(document.getElementById("btnSelectImplants")?.classList.contains("is-hidden")).toBe(false);
    });
  });
});
