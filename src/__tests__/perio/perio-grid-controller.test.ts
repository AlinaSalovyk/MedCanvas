import { describe, it, expect, beforeEach } from "vitest";
import {
  buildPerioGrid,
  syncPerioRow,
  __buildPerioGridForTest,
  __syncPerioRowForTest,
} from "@/engine/controls/perioGridController";
import {
  __buildPerioGridForTest as odontogramBuildPerioGrid,
  __syncPerioRowForTest as odontogramSyncPerioRow,
} from "@/odontogram";
import {
  getToothPerio,
  getToothCal,
  setPerioSite,
} from "@/state/perio";
import { defaultState, PERIO_SITES } from "@/state/payload";
import {
  setActiveTooth,
  clearSelection,
} from "@/engine/selection";
import {
  charts,
  setActiveChartMode,
} from "@/state/chart";
import { t } from "@/i18n/useI18n";

describe("perioGridController characterization tests (Stage 17)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    charts.status.clear();
    charts.plan.clear();
    setActiveChartMode("status");
    clearSelection();
  });

  describe("Grid DOM construction and canonical ordering", () => {
    it("handles null or missing container gracefully without throwing", () => {
      expect(() => buildPerioGrid(null)).not.toThrow();
      expect(() => buildPerioGrid(undefined)).not.toThrow();
    });

    it("builds exact 6-site structure in canonical buccal and lingual order", () => {
      const container = document.createElement("div");
      container.id = "perioGrid";
      document.body.appendChild(container);

      buildPerioGrid(container);

      expect(container.children.length).toBe(2);
      const buccalRow = container.children[0] as HTMLElement;
      const lingualRow = container.children[1] as HTMLElement;

      expect(buccalRow.className).toContain("perio-buccal-row");
      expect(lingualRow.className).toContain("perio-lingual-row");

      const cells = Array.from(container.querySelectorAll(".perio-site-cell"));
      expect(cells.length).toBe(6);

      const cellSites = cells.map((c) => c.getAttribute("data-site"));
      expect(cellSites).toEqual(["MB", "B", "DB", "ML", "L", "DL"]);
      expect(cellSites).toEqual(Array.from(PERIO_SITES));

      for (const site of PERIO_SITES) {
        const pd = container.querySelector(`#perio-pd-${site}`) as HTMLInputElement;
        const gm = container.querySelector(`#perio-gm-${site}`) as HTMLInputElement;
        const bop = container.querySelector(`#perio-bop-${site}`) as HTMLInputElement;
        const sup = container.querySelector(`#perio-sup-${site}`) as HTMLInputElement;

        expect(pd).toBeTruthy();
        expect(pd.type).toBe("number");
        expect(pd.getAttribute("data-site")).toBe(site);
        expect(pd.getAttribute("data-field")).toBe("pd");
        expect(pd.min).toBe("1");
        expect(pd.max).toBe("15");
        expect(pd.step).toBe("1");

        expect(gm).toBeTruthy();
        expect(gm.type).toBe("number");
        expect(gm.getAttribute("data-site")).toBe(site);
        expect(gm.getAttribute("data-field")).toBe("gm");
        expect(gm.min).toBe("-10");
        expect(gm.max).toBe("20");
        expect(gm.step).toBe("1");

        expect(bop).toBeTruthy();
        expect(bop.type).toBe("checkbox");
        expect(bop.getAttribute("data-site")).toBe(site);
        expect(bop.getAttribute("data-field")).toBe("bop");

        expect(sup).toBeTruthy();
        expect(sup.type).toBe("checkbox");
        expect(sup.getAttribute("data-site")).toBe(site);
        expect(sup.getAttribute("data-field")).toBe("sup");
      }
    });

    it("is idempotent: skips rebuild if container is already populated", () => {
      const container = document.createElement("div");
      document.body.appendChild(container);

      buildPerioGrid(container);
      const firstBuccal = container.children[0];

      // Second call must be a no-op and preserve identical children
      buildPerioGrid(container);
      expect(container.children[0]).toBe(firstBuccal);
    });
  });

  describe("Row visibility and input synchronization", () => {
    function mountFixture() {
      document.body.innerHTML = `
        <div id="perioRow">
          <div id="perioGrid"></div>
          <div id="perioReadout"></div>
        </div>
      `;
      const grid = document.getElementById("perioGrid") as HTMLElement;
      buildPerioGrid(grid);
      return {
        row: document.getElementById("perioRow") as HTMLElement,
        grid,
        readout: document.getElementById("perioReadout") as HTMLElement,
      };
    }

    it("hides #perioRow for missing, implant, or extraction teeth", () => {
      const { row } = mountFixture();

      syncPerioRow({ toothSelection: "none" }, 11);
      expect(row.classList.contains("hidden")).toBe(true);

      syncPerioRow({ toothSelection: "implant" }, 11);
      expect(row.classList.contains("hidden")).toBe(true);

      syncPerioRow({ toothSelection: "tooth-under-gum" }, 11);
      expect(row.classList.contains("hidden")).toBe(true);

      syncPerioRow({ toothSelection: "no-tooth-after-extraction" }, 11);
      expect(row.classList.contains("hidden")).toBe(true);

      syncPerioRow({ toothSelection: "tooth-base" }, 11);
      expect(row.classList.contains("hidden")).toBe(false);
    });

    it("is null-safe when elements are not mounted in DOM", () => {
      document.body.innerHTML = "";
      expect(() => syncPerioRow(defaultState(), 11)).not.toThrow();
      expect(() => syncPerioRow(defaultState(), null)).not.toThrow();
    });

    it("disables GM, BOP, and SUP when PD is not charted, and displays empty readout", () => {
      const { readout } = mountFixture();
      const state = defaultState();
      syncPerioRow(state, 11);

      for (const site of PERIO_SITES) {
        const pd = document.getElementById(`perio-pd-${site}`) as HTMLInputElement;
        const gm = document.getElementById(`perio-gm-${site}`) as HTMLInputElement;
        const bop = document.getElementById(`perio-bop-${site}`) as HTMLInputElement;
        const sup = document.getElementById(`perio-sup-${site}`) as HTMLInputElement;

        expect(pd.value).toBe("");
        expect(gm.value).toBe("");
        expect(bop.checked).toBe(false);
        expect(sup.checked).toBe(false);

        expect(gm.disabled).toBe(true);
        expect(bop.disabled).toBe(true);
        expect(sup.disabled).toBe(true);
      }

      expect(readout.textContent).toBe(t("perio.readout.empty"));
    });

    it("synchronizes charted site values, enables fields, and derives CAL and %BOP readout", () => {
      const { readout } = mountFixture();
      setPerioSite(16, "MB", { pd: 4, gm: 2, bop: true, sup: false });
      setPerioSite(16, "B", { pd: 3, gm: 0, bop: false, sup: true });

      syncPerioRow(defaultState(), 16);

      const mbPd = document.getElementById("perio-pd-MB") as HTMLInputElement;
      const mbGm = document.getElementById("perio-gm-MB") as HTMLInputElement;
      const mbBop = document.getElementById("perio-bop-MB") as HTMLInputElement;
      const mbSup = document.getElementById("perio-sup-MB") as HTMLInputElement;

      expect(mbPd.value).toBe("4");
      expect(mbGm.value).toBe("2");
      expect(mbBop.checked).toBe(true);
      expect(mbSup.checked).toBe(false);

      expect(mbGm.disabled).toBe(false);
      expect(mbBop.disabled).toBe(false);
      expect(mbSup.disabled).toBe(false);

      const bPd = document.getElementById("perio-pd-B") as HTMLInputElement;
      const bGm = document.getElementById("perio-gm-B") as HTMLInputElement;
      const bBop = document.getElementById("perio-bop-B") as HTMLInputElement;
      const bSup = document.getElementById("perio-sup-B") as HTMLInputElement;

      expect(bPd.value).toBe("3");
      expect(bGm.value).toBe("0");
      expect(bBop.checked).toBe(false);
      expect(bSup.checked).toBe(true);

      // Uncharted sites remain disabled
      const dbGm = document.getElementById("perio-gm-DB") as HTMLInputElement;
      expect(dbGm.disabled).toBe(true);

      // CAL: MB=6 (4+2), B=3 (3+0)
      const cal = getToothCal(16);
      expect(cal.get("MB")).toBe(6);
      expect(cal.get("B")).toBe(3);

      // BOP: 1 of 2 charted sites = 50%
      expect(readout.textContent).toContain(`MB ${t("perio.cal")} 6`);
      expect(readout.textContent).toContain(`B ${t("perio.cal")} 3`);
      expect(readout.textContent).toContain("50%");
      expect(readout.textContent).toContain("(1/2)");
    });
  });

  describe("Event listener execution and dynamic activeTooth reading", () => {
    function mountFixture() {
      document.body.innerHTML = `
        <div id="perioRow">
          <div id="perioGrid"></div>
          <div id="perioReadout"></div>
        </div>
      `;
      const grid = document.getElementById("perioGrid") as HTMLElement;
      buildPerioGrid(grid);
    }

    it("reads activeTooth live at event execution time across tooth switches", () => {
      mountFixture();

      // 1. Activate tooth 11 and chart PD
      setActiveTooth(11);
      const pdMb = document.getElementById("perio-pd-MB") as HTMLInputElement;
      pdMb.value = "5";
      pdMb.dispatchEvent(new Event("change", { bubbles: true }));

      expect(getToothPerio(11).pd.MB).toBe(5);
      expect(getToothPerio(21).pd.MB).toBeUndefined();

      // 2. Switch activeTooth to 21 without rebuilding the grid
      setActiveTooth(21);
      pdMb.value = "7";
      pdMb.dispatchEvent(new Event("change", { bubbles: true }));

      expect(getToothPerio(11).pd.MB).toBe(5); // unchanged
      expect(getToothPerio(21).pd.MB).toBe(7); // tooth 21 updated
    });

    it("handles PD blanking as site un-charting", () => {
      mountFixture();
      setActiveTooth(14);

      const pdMb = document.getElementById("perio-pd-MB") as HTMLInputElement;
      pdMb.value = "6";
      pdMb.dispatchEvent(new Event("change", { bubbles: true }));
      expect(getToothPerio(14).pd.MB).toBe(6);

      // Clear PD to empty string
      pdMb.value = "   ";
      pdMb.dispatchEvent(new Event("change", { bubbles: true }));
      expect(getToothPerio(14).pd.MB).toBeUndefined();
    });

    it("treats empty GM string as no-op and updates numeric GM", () => {
      mountFixture();
      setActiveTooth(15);

      const pd = document.getElementById("perio-pd-MB") as HTMLInputElement;
      const gm = document.getElementById("perio-gm-MB") as HTMLInputElement;

      pd.value = "4";
      pd.dispatchEvent(new Event("change", { bubbles: true }));

      // Set GM
      gm.value = "2";
      gm.dispatchEvent(new Event("change", { bubbles: true }));
      expect(getToothPerio(15).gm.MB).toBe(2);

      // Empty GM is immediate no-op
      gm.value = "";
      gm.dispatchEvent(new Event("change", { bubbles: true }));
      expect(getToothPerio(15).gm.MB).toBe(2);
    });

    it("updates BOP and SUP checkboxes directly via setPerioSite", () => {
      mountFixture();
      setActiveTooth(17);

      const pd = document.getElementById("perio-pd-DB") as HTMLInputElement;
      const bop = document.getElementById("perio-bop-DB") as HTMLInputElement;
      const sup = document.getElementById("perio-sup-DB") as HTMLInputElement;

      pd.value = "5";
      pd.dispatchEvent(new Event("change", { bubbles: true }));

      bop.checked = true;
      bop.dispatchEvent(new Event("change", { bubbles: true }));
      expect(getToothPerio(17).bop).toEqual(["DB"]);

      sup.checked = true;
      sup.dispatchEvent(new Event("change", { bubbles: true }));
      expect(getToothPerio(17).sup).toEqual(["DB"]);

      bop.checked = false;
      bop.dispatchEvent(new Event("change", { bubbles: true }));
      expect(getToothPerio(17).bop).toEqual([]);
    });

    it("does not mutate state if activeTooth is null", () => {
      mountFixture();
      setActiveTooth(null);

      const pd = document.getElementById("perio-pd-MB") as HTMLInputElement;
      pd.value = "5";
      pd.dispatchEvent(new Event("change", { bubbles: true }));

      // No tooth modified
      expect(getToothPerio(11).pd.MB).toBeUndefined();
    });
  });

  describe("Delegation parity with odontogram.ts public test seams", () => {
    it("__buildPerioGridForTest in odontogram delegates to the same implementation", () => {
      const containerA = document.createElement("div");
      const containerB = document.createElement("div");

      __buildPerioGridForTest(containerA);
      odontogramBuildPerioGrid(containerB);

      expect(containerA.innerHTML).toEqual(containerB.innerHTML);
    });

    it("__syncPerioRowForTest in odontogram delegates to the same implementation", () => {
      document.body.innerHTML = `
        <div id="perioRow">
          <div id="perioGrid"></div>
          <div id="perioReadout"></div>
        </div>
      `;
      const grid = document.getElementById("perioGrid") as HTMLElement;
      buildPerioGrid(grid);

      setPerioSite(24, "MB", { pd: 4, gm: 1 });
      odontogramSyncPerioRow(defaultState(), 24);

      const pd = document.getElementById("perio-pd-MB") as HTMLInputElement;
      expect(pd.value).toBe("4");
    });
  });
});
