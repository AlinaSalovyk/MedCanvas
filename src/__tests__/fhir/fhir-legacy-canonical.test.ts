// Verification of canonical URL backward compatibility:
// A bundle exported under an older canonical URL on local codes must still
// import with all tooth findings, periodontal data, and case context intact.
import { describe, it, expect, beforeEach } from "vitest";
import { parseFhirBundle } from "../../fhir/fromFhir";
import { LOCAL_SYSTEM, LOCAL_SYSTEMS, isLocalSystem } from "../../fhir/codesystems";
import {
  __resetChartStateForTest, importStatus, exportFhir, PERIO_SITES,
  setPerioSite, setFurcation, setPlaque, setSmokingStatus, setDiabetesStatus, setHba1c, setCaseCondition,
} from "../../odontogram";

const NEW_BASE = "https://odontogram.app/fhir";
const OLD_BASE = "https://odontogram.app/legacy/fhir";

/** A chart that exercises every reader of the local system: registry findings,
 *  the periodontal panel, and the case block's laterality coding. */
function richBundle(): unknown {
  __resetChartStateForTest();
  importStatus({
    version: "2.22", globals: {},
    teeth: {
      "11": { toothSelection: "tooth-base", caries: ["caries-occlusal"], cariesSeverity: { occlusal: 5 } },
      "16": { toothSelection: "tooth-base", restorationType: "crown", restorationMaterial: "zircon", endo: "endo-filling" },
      "36": { toothSelection: "implant" },
      "46": { toothSelection: "tooth-base", fillingSurfaces: ["occlusal"], fillingSurfaceMaterials: { occlusal: "composite" } },
    },
  });
  for (const s of PERIO_SITES) setPerioSite(16, s, { pd: 5, gm: 2, bop: true });
  setFurcation(16, "mesial", 2);
  setPlaque(11, "buccal", true);
  setSmokingStatus("current"); setDiabetesStatus("present"); setHba1c(7.4);
  setCaseCondition("tmjDisorder", "left");
  return exportFhir();
}

describe("FHIR: the pre-rename canonical URL still imports", () => {
  beforeEach(() => __resetChartStateForTest());

  it("exports under the NEW canonical only", () => {
    const json = JSON.stringify(richBundle());
    expect(LOCAL_SYSTEM.startsWith(NEW_BASE)).toBe(true);
    expect(json).toContain(`${NEW_BASE}/CodeSystem/odontogram`);
    expect(json).not.toContain(OLD_BASE);
  });

  it("a bundle written under the OLD canonical imports exactly like the new one", () => {
    const current = richBundle();
    // What the same chart looked like when exported before 2.6.0.
    const legacy = JSON.parse(JSON.stringify(current).split(NEW_BASE).join(OLD_BASE));
    expect(JSON.stringify(legacy)).not.toContain(NEW_BASE);

    const fromNew = parseFhirBundle(current) as unknown as Record<string, unknown>;
    const fromOld = parseFhirBundle(legacy) as unknown as Record<string, unknown>;

    // Not a vacuous comparison: the fixture really carries every kind of data…
    const teeth = fromNew.teeth as Record<string, Record<string, unknown>>;
    expect(teeth["16"]?.perio).toBeDefined();
    expect(teeth["16"]?.furcation).toBeDefined();
    expect(teeth["11"]?.plaque).toEqual(["buccal"]);
    expect((fromNew.case as Record<string, unknown>)?.caseConditions).toEqual({ tmjDisorder: "left" });
    expect((fromNew.case as Record<string, unknown>)?.smokingStatus).toBe("current");
    // …and the old bundle yields all of it, identically.
    expect(fromOld).toEqual(fromNew);
  });

  it("recognises both canonicals, and nothing else", () => {
    expect(LOCAL_SYSTEMS.size).toBe(2);
    expect(isLocalSystem(`${NEW_BASE}/CodeSystem/odontogram`)).toBe(true);
    expect(isLocalSystem(`${OLD_BASE}/CodeSystem/odontogram`)).toBe(true);
    expect(isLocalSystem("http://snomed.info/sct")).toBe(false);
    expect(isLocalSystem(`${NEW_BASE}/CodeSystem/odontogram/`)).toBe(false);   // exact match only
    expect(isLocalSystem(undefined)).toBe(false);
  });
});
