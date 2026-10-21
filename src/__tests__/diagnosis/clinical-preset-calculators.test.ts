import { describe, it, expect } from "vitest";
import {
  calculateStatusPresetChanges,
  calculateSpanPreset,
  calculateArchBridgePreset,
  calculatePartialRemovablePreset,
  calculateFullRemovablePreset,
  calculateBarDenturePreset,
  calculatePrimaryDentitionTarget,
  calculateMixedDentitionTarget,
  toRestorationMaterial,
  setBridgeCrown,
  setBridgePontic,
  createCandidateAccumulator,
  type ClinicalPresetContext,
} from "../../engine/presets/clinicalPresetCalculators";
import { defaultState, serializeState } from "../../state/payload";
import {
  PRIMARY_MILK,
  MIXED_PERMANENT,
  MIXED_MILK,
  MIXED_NONE,
} from "../../engine/constants";
import { ALL_TEETH } from "../../anatomy/profiles";

describe("clinicalPresetCalculators unit test suite", () => {
  const emptyContext: ClinicalPresetContext = {
    getCurrentState: (_toothNo: number) => undefined,
  };

  const createMockContext = (stateMap: Map<number, Record<string, unknown>>): ClinicalPresetContext => ({
    getCurrentState: (toothNo: number) => stateMap.get(toothNo),
  });

  // =========================================================================
  // 1. Helpers & Material Conversion
  // =========================================================================
  describe("Helper functions", () => {
    it("toRestorationMaterial converts 'metal' to 'metal-ceramic' and preserves others", () => {
      expect(toRestorationMaterial("metal")).toBe("metal-ceramic");
      expect(toRestorationMaterial("zircon")).toBe("zircon");
      expect(toRestorationMaterial("gold")).toBe("gold");
      expect(toRestorationMaterial("composite")).toBe("composite");
    });

    it("setBridgeCrown sets crownprep, crown, bridgePillar and clears broken surfaces", () => {
      const s = defaultState();
      s.brokenMesial = true;
      s.brokenIncisal = true;
      s.brokenDistal = true;

      setBridgeCrown(s, "metal");

      expect(s.toothSubstrate).toBe("crownprep");
      expect(s.restorationType).toBe("crown");
      expect(s.restorationMaterial).toBe("metal-ceramic");
      expect(s.bridgePillar).toBe(true);
      expect(s.brokenMesial).toBe(false);
      expect(s.brokenIncisal).toBe(false);
      expect(s.brokenDistal).toBe(false);
    });

    it("setBridgePontic sets restorationType bridge and maps material", () => {
      const s = defaultState();
      setBridgePontic(s, "metal");
      expect(s.restorationType).toBe("bridge");
      expect(s.restorationMaterial).toBe("metal-ceramic");
    });
  });

  // =========================================================================
  // 2. Unsupported vs Supported Preset Distinction
  // =========================================================================
  describe("Unsupported vs Supported options", () => {
    it("returns null for null, undefined, primitives, empty object, or unknown types", () => {
      expect(calculateStatusPresetChanges(null, emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges(undefined, emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges("foo", emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges(123, emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges(true, emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges(Symbol("test"), emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges({}, emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges({ type: "unknown" }, emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges({ type: "implant" }, emptyContext)).toBeNull();
      expect(calculateStatusPresetChanges({ id: "no-type" }, emptyContext)).toBeNull();
    });

    it("returns a Map (not null) for supported presets even when 0 teeth change", () => {
      const resSpan = calculateStatusPresetChanges({ type: "span", teeth: [] }, emptyContext);
      expect(resSpan).toBeInstanceOf(Map);
      expect(resSpan!.size).toBe(0);

      const resBridge = calculateStatusPresetChanges(
        { type: "arch-bridge", arch: "upper", material: "zircon" },
        emptyContext,
      );
      expect(resBridge).toBeInstanceOf(Map);
    });

    it("accepts a callable function object that has a supported .type property", () => {
      const callableOption: any = () => {};
      callableOption.type = "span";
      callableOption.teeth = [12];
      callableOption.material = "zircon";
      const res = calculateStatusPresetChanges(callableOption, emptyContext);
      expect(res).toBeInstanceOf(Map);
      expect(res!.has(12)).toBe(true);
    });

    it("dispatches using ordered sequential property reads for objects with dynamic type getters", () => {
      let readCount = 0;
      const dynamicOption = {
        get type() {
          readCount++;
          // 1st read (span check): returns "mismatch"
          // 2nd read (arch-bridge check): returns "arch-bridge"
          if (readCount === 1) return "mismatch";
          if (readCount === 2) return "arch-bridge";
          return "mismatch";
        },
        arch: "upper",
        material: "zircon",
      };
      const res = calculateStatusPresetChanges(dynamicOption, emptyContext);
      expect(res).toBeInstanceOf(Map);
      // Evaluates span (read 1: mismatch), then arch-bridge (read 2: match)
      expect(readCount).toBe(2);
    });

    it("dispatches conventional supported preset objects correctly", () => {
      const spanOption = { type: "span", teeth: [12], material: "zircon" };
      const res = calculateStatusPresetChanges(spanOption, emptyContext);
      expect(res).toBeInstanceOf(Map);
      expect(res!.has(12)).toBe(true);
    });
  });

  // =========================================================================
  // 3. Candidate Accumulator Mechanics
  // =========================================================================
  describe("createCandidateAccumulator mechanics", () => {
    it("preserves insertion order of entries in candidate map", () => {
      const { changes, collect } = createCandidateAccumulator(emptyContext);
      collect([14, 11, 23, 21], (s) => {
        s.notes = "test";
      });

      const keys = [...changes.keys()];
      expect(keys).toEqual([14, 11, 23, 21]);
    });

    it("prior candidate takes precedence on repeated tooth references", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      const base14 = defaultState();
      base14.toothSelection = "tooth-base";
      stateMap.set(14, base14);

      const ctx = createMockContext(stateMap);
      const { changes, collect } = createCandidateAccumulator(ctx);

      // Pass 1: sets crown
      collect([14], (s) => {
        s.restorationType = "crown";
      });
      expect(changes.get(14).restorationType).toBe("crown");

      // Pass 2: reads the accumulated state, updates notes
      collect([14], (s) => {
        expect(s.restorationType).toBe("crown"); // Saw Pass 1 candidate!
        s.notes = "updated";
      });

      expect(changes.get(14).restorationType).toBe("crown");
      expect(changes.get(14).notes).toBe("updated");
    });

    it("does not mutate the original state object in context", () => {
      const original = defaultState();
      original.toothSelection = "tooth-base";
      const serializedBefore = JSON.stringify(serializeState(original));

      const stateMap = new Map<number, Record<string, unknown>>([[11, original]]);
      const ctx = createMockContext(stateMap);

      const { changes, collect } = createCandidateAccumulator(ctx);
      collect([11], (s) => {
        s.restorationType = "crown";
        s.restorationMaterial = "zircon";
        s.brokenMesial = true;
      });

      // Candidate has modifications
      expect(changes.get(11).restorationType).toBe("crown");

      // Original state in context remains completely untouched
      const serializedAfter = JSON.stringify(serializeState(original));
      expect(serializedAfter).toBe(serializedBefore);
      expect(original.restorationType).toBe("none");
      expect(original.brokenMesial).toBe(false);
    });

    it("falls back to defaultState when context returns undefined", () => {
      const { changes, collect } = createCandidateAccumulator(emptyContext);
      collect([12], (s) => {
        expect(s.toothSelection).toBe("tooth-base"); // defaultState()
        s.prosthesis = "bar-denture";
      });
      expect(changes.get(12).prosthesis).toBe("bar-denture");
    });
  });

  // =========================================================================
  // 4. Span Preset
  // =========================================================================
  describe("Span preset calculation", () => {
    it("assigns pillar crown to tooth-base and pontic to none teeth", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      const s12 = defaultState(); s12.toothSelection = "tooth-base";
      const s11 = defaultState(); s11.toothSelection = "none";
      const s21 = defaultState(); s21.toothSelection = "tooth-base";
      stateMap.set(12, s12);
      stateMap.set(11, s11);
      stateMap.set(21, s21);

      const ctx = createMockContext(stateMap);
      const changes = calculateSpanPreset({ teeth: [12, 11, 21], material: "metal" }, ctx);

      expect(changes.size).toBe(3);
      // 12 is pillar crown
      expect(changes.get(12).restorationType).toBe("crown");
      expect(changes.get(12).restorationMaterial).toBe("metal-ceramic");
      expect(changes.get(12).bridgePillar).toBe(true);
      expect(changes.get(12).toothSubstrate).toBe("crownprep");

      // 11 is pontic
      expect(changes.get(11).restorationType).toBe("bridge");
      expect(changes.get(11).restorationMaterial).toBe("metal-ceramic");
      expect(changes.get(11).bridgePillar).toBe(false);

      // 21 is pillar crown
      expect(changes.get(21).restorationType).toBe("crown");
      expect(changes.get(21).bridgePillar).toBe(true);
    });

    it("leaves teeth with toothSelection other than tooth-base or none un-restored", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      const s12 = defaultState(); s12.toothSelection = "implant";
      stateMap.set(12, s12);

      const ctx = createMockContext(stateMap);
      const changes = calculateSpanPreset({ teeth: [12], material: "zircon" }, ctx);

      expect(changes.get(12).restorationType).toBe("none");
      expect(changes.get(12).toothSelection).toBe("implant");
    });
  });

  // =========================================================================
  // 5. Arch Bridge Preset
  // =========================================================================
  describe("Arch Bridge preset calculation", () => {
    it("normal branch (>= 2 present teeth): creates pillars and intermediate pontics", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      // Upper arch: 18..14 missing, 13 present, 12..22 missing, 23 present, 24..28 missing
      for (const tn of [18, 17, 16, 15, 14, 12, 11, 21, 22, 24, 25, 26, 27, 28]) {
        const s = defaultState(); s.toothSelection = "none";
        stateMap.set(tn, s);
      }
      const s13 = defaultState(); s13.toothSelection = "tooth-base"; stateMap.set(13, s13);
      const s23 = defaultState(); s23.toothSelection = "tooth-base"; stateMap.set(23, s23);

      const ctx = createMockContext(stateMap);
      const changes = calculateArchBridgePreset(
        { arch: "upper", material: "zircon", missingMaterial: "zircon" },
        ctx,
      );

      // Pillars
      expect(changes.get(13).restorationType).toBe("crown");
      expect(changes.get(13).bridgePillar).toBe(true);
      expect(changes.get(23).restorationType).toBe("crown");
      expect(changes.get(23).bridgePillar).toBe(true);

      // Intermediate pontics (12, 11, 21, 22)
      for (const tn of [12, 11, 21, 22]) {
        expect(changes.get(tn).restorationType).toBe("bridge");
        expect(changes.get(tn).restorationMaterial).toBe("zircon");
      }

      // Outside intermediate: 17, 16, 15, 14 remain none
      for (const tn of [17, 16, 15, 14, 24, 25, 26, 27]) {
        expect(changes.get(tn).restorationType).toBe("none");
      }

      // Wisdom teeth 18, 28 are excluded (untouched in loop)
      expect(changes.get(18).restorationType).toBe("none");
      expect(changes.get(28).restorationType).toBe("none");
    });

    it("fallback branch (< 2 present teeth, 1 solitary present tooth): crowns solitary tooth, 0 pontics", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      for (const tn of [18, 17, 16, 15, 14, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        const s = defaultState(); s.toothSelection = "none";
        stateMap.set(tn, s);
      }
      const s13 = defaultState(); s13.toothSelection = "tooth-base"; stateMap.set(13, s13);

      const ctx = createMockContext(stateMap);
      const changes = calculateArchBridgePreset({ arch: "upper", material: "zircon" }, ctx);

      // Solitary present tooth crowned
      expect(changes.get(13).restorationType).toBe("crown");
      expect(changes.get(13).bridgePillar).toBe(true);

      // NO pontics created on any missing tooth in fallback
      for (const tn of [17, 16, 15, 14, 12, 11, 21, 22, 23, 24, 25, 26, 27]) {
        expect(changes.get(tn).restorationType).toBe("none");
      }
    });

    it("fallback branch with 0 present teeth: all missing remain none", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      for (const tn of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        const s = defaultState(); s.toothSelection = "none";
        stateMap.set(tn, s);
      }

      const ctx = createMockContext(stateMap);
      const changes = calculateArchBridgePreset({ arch: "upper", material: "zircon" }, ctx);

      for (const tn of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        expect(changes.get(tn).restorationType).toBe("none");
      }
    });

    it("wisdom exclusion in fallback branch ignores solitary wisdom tooth", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      for (const tn of [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        const s = defaultState(); s.toothSelection = "none";
        stateMap.set(tn, s);
      }
      const s18 = defaultState(); s18.toothSelection = "tooth-base"; stateMap.set(18, s18);

      const ctx = createMockContext(stateMap);
      const changes = calculateArchBridgePreset({ arch: "upper", material: "zircon" }, ctx);

      // 18 is wisdom, so excluded
      expect(changes.get(18).restorationType).toBe("none");
    });
  });

  // =========================================================================
  // 6. Partial Removable Preset
  // =========================================================================
  describe("Partial Removable preset calculation", () => {
    it("sets prosthesis: removable-partial on missing teeth, excludes wisdom and present teeth", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      // Tooth 14 and 16 are missing; 15 is tooth-base; 18 is missing (wisdom)
      const s14 = defaultState(); s14.toothSelection = "none"; stateMap.set(14, s14);
      const s16 = defaultState(); s16.toothSelection = "none"; stateMap.set(16, s16);
      const s15 = defaultState(); s15.toothSelection = "tooth-base"; stateMap.set(15, s15);
      const s18 = defaultState(); s18.toothSelection = "none"; stateMap.set(18, s18);

      const ctx = createMockContext(stateMap);
      const changes = calculatePartialRemovablePreset({ arch: "upper" }, ctx);

      expect(changes.get(14).prosthesis).toBe("removable-partial");
      expect(changes.get(16).prosthesis).toBe("removable-partial");
      expect(changes.get(15).prosthesis).toBe("none"); // present -> skipped
      expect(changes.get(18).prosthesis).toBe("none"); // wisdom -> skipped
    });
  });

  // =========================================================================
  // 7. Full Removable Preset
  // =========================================================================
  describe("Full Removable preset calculation", () => {
    it("replaces state with defaultState() + none + removable-full on non-wisdom, none on wisdom", () => {
      const stateMap = new Map<number, Record<string, unknown>>();
      const s14 = defaultState();
      s14.toothSelection = "tooth-base";
      s14.restorationType = "crown";
      s14.restorationMaterial = "gold";
      s14.brokenDistal = true;
      stateMap.set(14, s14);

      const s18 = defaultState();
      s18.toothSelection = "tooth-base";
      s18.restorationType = "crown";
      stateMap.set(18, s18);

      const ctx = createMockContext(stateMap);
      const changes = calculateFullRemovablePreset({ arch: "upper" }, ctx);

      // Non-wisdom 14
      const c14 = changes.get(14);
      expect(c14.toothSelection).toBe("none");
      expect(c14.prosthesis).toBe("removable-full");
      expect(c14.restorationType).toBe("none");
      expect(c14.brokenDistal).toBe(false);

      // Wisdom 18
      const c18 = changes.get(18);
      expect(c18.toothSelection).toBe("none");
      expect(c18.prosthesis).toBe("none");
      expect(c18.restorationType).toBe("none");
    });
  });

  // =========================================================================
  // 8. Bar Denture Preset & Sequential Overlaps
  // =========================================================================
  describe("Bar Denture preset calculation & 3-pass sequence", () => {
    it("executes 3 passes in order: implants -> missing -> sevenEight", () => {
      const option = {
        arch: "upper",
        implants: [14, 12, 22, 24],
        missing: [16, 15, 13, 11, 21, 23, 25, 26],
      };

      const changes = calculateBarDenturePreset(option, emptyContext);

      // Implants
      for (const tn of [14, 12, 22, 24]) {
        expect(changes.get(tn).toothSelection).toBe("implant");
        expect(changes.get(tn).prosthesis).toBe("bar-denture");
      }

      // Missing
      for (const tn of [16, 15, 13, 11, 21, 23, 25, 26]) {
        expect(changes.get(tn).toothSelection).toBe("none");
        expect(changes.get(tn).prosthesis).toBe("bar-denture");
      }

      // Seven/Eight teeth in arch (17, 18, 27, 28)
      for (const tn of [17, 18, 27, 28]) {
        expect(changes.get(tn).toothSelection).toBe("none");
        expect(changes.get(tn).prosthesis).toBe("none");
      }
    });

    it("overlap precedence: missing pass overwrites implant pass", () => {
      const overlapOption = {
        arch: "upper",
        implants: [14, 12],
        missing: [14, 11], // 14 in both
      };

      const changes = calculateBarDenturePreset(overlapOption, emptyContext);

      expect(changes.get(14).toothSelection).toBe("none"); // Missing pass won
      expect(changes.get(14).prosthesis).toBe("bar-denture");
      expect(changes.get(12).toothSelection).toBe("implant");
    });

    it("overlap precedence: sevenEight pass overwrites implant and missing passes", () => {
      const overlapOption = {
        arch: "upper",
        implants: [17], // 17 ends in 7
        missing: [28],  // 28 ends in 8
      };

      const changes = calculateBarDenturePreset(overlapOption, emptyContext);

      // Both 17 and 28 are overwritten by Pass 3 to none / default prosthesis ('none')
      expect(changes.get(17).toothSelection).toBe("none");
      expect(changes.get(17).prosthesis).toBe("none");
      expect(changes.get(28).toothSelection).toBe("none");
      expect(changes.get(28).prosthesis).toBe("none");
    });

    it("handles repeated entries in input lists gracefully without order disruption", () => {
      const option = {
        arch: "upper",
        implants: [14, 14, 12],
        missing: [16, 16],
      };

      const changes = calculateBarDenturePreset(option, emptyContext);

      expect(changes.get(14).toothSelection).toBe("implant");
      expect(changes.get(16).toothSelection).toBe("none");
    });
  });

  // =========================================================================
  // 4. Primary Dentition Target Calculator (calculatePrimaryDentitionTarget)
  // =========================================================================
  describe("calculatePrimaryDentitionTarget", () => {
    it("assigns milktooth to all PRIMARY_MILK positions and none to all others across ALL_TEETH", () => {
      expect(ALL_TEETH.length).toBe(32);
      for (const tn of ALL_TEETH) {
        const target = calculatePrimaryDentitionTarget(tn);
        if (PRIMARY_MILK.has(tn)) {
          expect(target.toothSelection).toBe("milktooth");
        } else {
          expect(target.toothSelection).toBe("none");
        }
      }
    });

    it("explicitly confirms all 20 deciduous tooth positions get milktooth", () => {
      const deciduousPositions = [
        11, 12, 13, 14, 15,
        21, 22, 23, 24, 25,
        31, 32, 33, 34, 35,
        41, 42, 43, 44, 45,
      ];
      expect(deciduousPositions.length).toBe(20);
      for (const tn of deciduousPositions) {
        expect(calculatePrimaryDentitionTarget(tn).toothSelection).toBe("milktooth");
      }
    });

    it("explicitly confirms all 12 permanent molar positions get none", () => {
      const permanentMolarPositions = [
        16, 17, 18,
        26, 27, 28,
        36, 37, 38,
        46, 47, 48,
      ];
      expect(permanentMolarPositions.length).toBe(12);
      for (const tn of permanentMolarPositions) {
        expect(calculatePrimaryDentitionTarget(tn).toothSelection).toBe("none");
      }
    });

    it("preserves canonical defaultState fields outside toothSelection", () => {
      const targetMilk = calculatePrimaryDentitionTarget(11);
      const targetNone = calculatePrimaryDentitionTarget(16);

      for (const target of [targetMilk, targetNone]) {
        expect(target.prosthesis).toBe("none");
        expect(target.restorationType).toBe("none");
        expect(target.restorationMaterial).toBe("none");
        expect(target.toothSubstrate).toBe("natural");
        expect(target.endoResection).toBe(false);
        expect(target.mods.size).toBe(0);
        expect(target.caries.size).toBe(0);
        expect(target.fillingSurfaces.size).toBe(0);
        expect(target.fissureSealing).toBe(false);
        expect(target.mobility).toBe("none");
        expect(target.pulpDx).toBe("normal");
      }
    });
  });

  // =========================================================================
  // 5. Mixed Dentition Target Calculator (calculateMixedDentitionTarget)
  // =========================================================================
  describe("calculateMixedDentitionTarget", () => {
    it("assigns correct selections across all 32 teeth adhering to set membership", () => {
      expect(ALL_TEETH.length).toBe(32);
      for (const tn of ALL_TEETH) {
        const target = calculateMixedDentitionTarget(tn);
        if (MIXED_PERMANENT.has(tn)) {
          expect(target.toothSelection).toBe("tooth-base");
        } else if (MIXED_MILK.has(tn)) {
          expect(target.toothSelection).toBe("milktooth");
        } else if (MIXED_NONE.has(tn)) {
          expect(target.toothSelection).toBe("none");
        }
      }
    });

    it("explicitly confirms all 12 MIXED_PERMANENT teeth get tooth-base", () => {
      const permTeeth = [11, 12, 16, 21, 22, 26, 31, 32, 36, 41, 42, 46];
      expect(permTeeth.length).toBe(12);
      for (const tn of permTeeth) {
        expect(calculateMixedDentitionTarget(tn).toothSelection).toBe("tooth-base");
      }
    });

    it("explicitly confirms all 12 MIXED_MILK teeth get milktooth", () => {
      const milkTeeth = [13, 14, 15, 23, 24, 25, 33, 34, 35, 43, 44, 45];
      expect(milkTeeth.length).toBe(12);
      for (const tn of milkTeeth) {
        expect(calculateMixedDentitionTarget(tn).toothSelection).toBe("milktooth");
      }
    });

    it("explicitly confirms all 8 MIXED_NONE teeth get none", () => {
      const noneTeeth = [17, 18, 27, 28, 37, 38, 47, 48];
      expect(noneTeeth.length).toBe(8);
      for (const tn of noneTeeth) {
        expect(calculateMixedDentitionTarget(tn).toothSelection).toBe("none");
      }
    });

    it("preserves branch precedence and defaultState fallback for non-matching teeth", () => {
      const unmatchedTarget = calculateMixedDentitionTarget(99);
      expect(unmatchedTarget.toothSelection).toBe("tooth-base");
      expect(unmatchedTarget.prosthesis).toBe("none");
      expect(unmatchedTarget.restorationType).toBe("none");
    });

    it("preserves canonical defaultState fields outside toothSelection", () => {
      const targetBase = calculateMixedDentitionTarget(11);
      const targetMilk = calculateMixedDentitionTarget(13);
      const targetNone = calculateMixedDentitionTarget(17);

      for (const target of [targetBase, targetMilk, targetNone]) {
        expect(target.prosthesis).toBe("none");
        expect(target.restorationType).toBe("none");
        expect(target.restorationMaterial).toBe("none");
        expect(target.toothSubstrate).toBe("natural");
        expect(target.caries.size).toBe(0);
        expect(target.mods.size).toBe(0);
        expect(target.fissureSealing).toBe(false);
      }
    });
  });

  // =========================================================================
  // 6. Memory Allocation & Purity Invariants
  // =========================================================================
  describe("Target Calculators Purity & Allocation Invariants", () => {
    it("allocates a fresh defaultState object on every call (no shared cache)", () => {
      const p1 = calculatePrimaryDentitionTarget(11);
      const p2 = calculatePrimaryDentitionTarget(11);
      expect(p1).not.toBe(p2);
      expect(p1).toEqual(p2);

      const m1 = calculateMixedDentitionTarget(13);
      const m2 = calculateMixedDentitionTarget(13);
      expect(m1).not.toBe(m2);
      expect(m1).toEqual(m2);
    });

    it("modifying a returned target object does not pollute future invocations", () => {
      const p = calculatePrimaryDentitionTarget(11);
      p.toothSelection = "implant";
      p.fissureSealing = true;
      p.caries.add("occlusal");

      const freshP = calculatePrimaryDentitionTarget(11);
      expect(freshP.toothSelection).toBe("milktooth");
      expect(freshP.fissureSealing).toBe(false);
      expect(freshP.caries.size).toBe(0);

      const m = calculateMixedDentitionTarget(13);
      m.toothSelection = "none";
      m.prosthesis = "bar-denture";

      const freshM = calculateMixedDentitionTarget(13);
      expect(freshM.toothSelection).toBe("milktooth");
      expect(freshM.prosthesis).toBe("none");
    });
  });
});
