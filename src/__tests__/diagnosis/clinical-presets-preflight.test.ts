import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyStatusExtra,
  __applyStatusExtraForTest,
  applyPrimaryDentition,
  applyMixedDentition,
  __applyDentitionPresetForTest,
  setEdentulous,
  __setEdentulousForTest,
  resetMouth,
  setChartMode,
  getPlanChanges,
  getStatusChart,
  isDualStateConfirmPending,
  acceptDualStateConfirm,
  cancelDualStateConfirm,
  onStateChange,
  setPerioSite,
  getToothPerio,
  setCaseAge,
  getCaseMeta,
  resetCaseMeta,
  __resetChartStateForTest,
  __planEditedTeethForTest,
  __setToothStateForTest,
  __getToothStateForTest,
} from "../../odontogram";
import { ALL_TEETH } from "../../anatomy/profiles";
import { PRIMARY_MILK, MIXED_PERMANENT, MIXED_MILK, MIXED_NONE } from "../../engine/constants";
import { STATUS_EXTRAS } from "../../status_extras";
import { defaultState } from "../../state/payload";

describe("Stage 13: Clinical Presets Characterization & Regression Safety Baseline", () => {
  beforeEach(() => {
    __resetChartStateForTest();
    __setEdentulousForTest(false);
    resetCaseMeta();
    // Populate all teeth with clean baseline defaultState so toothState has all entries
    for (const tn of ALL_TEETH) {
      __setToothStateForTest(tn, {});
    }
  });

  // Helper to plan-edit a tooth (Pd=6 in plan mode, Pd=5 in status mode)
  function planEditTooth(toothNo: number, statusPd = 5, planPd = 6) {
    setPerioSite(toothNo, "MB", { pd: statusPd });
    setChartMode("plan");
    setPerioSite(toothNo, "MB", { pd: planPd });
    expect(__planEditedTeethForTest()).toContain(toothNo);
    setChartMode("status");
  }

  // =========================================================================
  // 2. GAP-1: Bar Denture
  // =========================================================================
  describe("GAP-1: Bar Denture preset characterization", () => {
    it("assigns implant/bar-denture to implants, missing/bar-denture to missing, and missing/none to 7 and 8 teeth", () => {
      const option = {
        type: "bar-denture",
        arch: "upper",
        implants: [14, 12, 22, 24],
        missing: [16, 15, 13, 11, 21, 23, 25, 26],
      };
      applyStatusExtra(option);

      // Implants receive defaultState with toothSelection: 'implant' and prosthesis: 'bar-denture'
      for (const tn of [14, 12, 22, 24]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("implant");
        expect(s.prosthesis).toBe("bar-denture");
        expect(s.restorationType).toBe("none");
      }

      // Explicit missing teeth receive defaultState with toothSelection: 'none' and prosthesis: 'bar-denture'
      for (const tn of [16, 15, 13, 11, 21, 23, 25, 26]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("bar-denture");
        expect(s.restorationType).toBe("none");
      }

      // Arch positions ending in 7 or 8 (17, 18, 27, 28) receive defaultState with toothSelection: 'none' and prosthesis: 'none'
      for (const tn of [17, 18, 27, 28]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("none");
      }

      // Unmentioned lower arch teeth remain completely untouched in default permanent state
      for (const tn of [41, 42, 43, 44, 45, 46, 47, 48, 31, 32, 33, 34, 35, 36, 37, 38]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("tooth-base");
        expect(s.prosthesis).toBe("none");
      }
    });

    it("executes all three collect passes in order: implants -> missing -> 7/8 precedence", () => {
      // Overlap A: tooth in both implants and missing -> missing pass (Pass 2) runs after implants (Pass 1)
      const overlapImplantsAndMissing = {
        type: "bar-denture",
        arch: "upper",
        implants: [14, 12],
        missing: [14, 11], // 14 is in both
      };
      __applyStatusExtraForTest(overlapImplantsAndMissing);
      expect(__getToothStateForTest(14)!.toothSelection).toBe("none"); // missing took precedence
      expect(__getToothStateForTest(14)!.prosthesis).toBe("bar-denture");
      expect(__getToothStateForTest(12)!.toothSelection).toBe("implant");

      // Reset
      for (const tn of ALL_TEETH) __setToothStateForTest(tn, {});

      // Overlap B: tooth ending in 7 or 8 is placed in implants -> sevenEight pass (Pass 3) runs last
      const overlapImplantsAndSevenEight = {
        type: "bar-denture",
        arch: "upper",
        implants: [17, 18, 14], // 17, 18 end in 7/8
        missing: [11],
      };
      __applyStatusExtraForTest(overlapImplantsAndSevenEight);
      // 17 and 18 are overwritten by Pass 3 to missing with default prosthesis ('none')
      expect(__getToothStateForTest(17)!.toothSelection).toBe("none");
      expect(__getToothStateForTest(17)!.prosthesis).toBe("none");
      expect(__getToothStateForTest(18)!.toothSelection).toBe("none");
      expect(__getToothStateForTest(18)!.prosthesis).toBe("none");
      // 14 stays implant/bar-denture
      expect(__getToothStateForTest(14)!.toothSelection).toBe("implant");
      expect(__getToothStateForTest(14)!.prosthesis).toBe("bar-denture");

      // Reset
      for (const tn of ALL_TEETH) __setToothStateForTest(tn, {});

      // Overlap C: tooth ending in 7 or 8 is placed in missing -> sevenEight pass (Pass 3) resets prosthesis to none
      const overlapMissingAndSevenEight = {
        type: "bar-denture",
        arch: "upper",
        implants: [14],
        missing: [27, 28], // 27, 28 end in 7/8
      };
      __applyStatusExtraForTest(overlapMissingAndSevenEight);
      expect(__getToothStateForTest(27)!.toothSelection).toBe("none");
      expect(__getToothStateForTest(27)!.prosthesis).toBe("none"); // NOT 'bar-denture'
      expect(__getToothStateForTest(28)!.toothSelection).toBe("none");
      expect(__getToothStateForTest(28)!.prosthesis).toBe("none");
    });

    it("passes through single gateToothEditBatch, defers confirm if any changed tooth is planned, and cancels safely", () => {
      planEditTooth(14); // tooth 14 is plan-edited
      planEditTooth(16); // tooth 16 is plan-edited

      const option = {
        type: "bar-denture",
        arch: "upper",
        implants: [14, 12],
        missing: [16, 15],
      };
      __applyStatusExtraForTest(option);

      // Exactly ONE confirmation is pending
      expect(isDualStateConfirmPending()).toBe(true);

      // NO changes committed while pending
      expect(__getToothStateForTest(14)!.toothSelection).toBe("tooth-base");
      expect(__getToothStateForTest(12)!.toothSelection).toBe("tooth-base");
      expect(__getToothStateForTest(16)!.toothSelection).toBe("tooth-base");

      // Cancel leaves clinical states unchanged
      cancelDualStateConfirm();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(14)!.toothSelection).toBe("tooth-base");
      expect(__getToothStateForTest(12)!.toothSelection).toBe("tooth-base");
      expect(__getToothStateForTest(16)!.toothSelection).toBe("tooth-base");
    });

    it("acceptance applies entire batch: planned teeth diverge, unplanned teeth mirror", () => {
      planEditTooth(14); // 14 planned
      // 12 is unplanned

      const option = {
        type: "bar-denture",
        arch: "upper",
        implants: [14, 12],
        missing: [16],
      };
      __applyStatusExtraForTest(option);
      expect(isDualStateConfirmPending()).toBe(true);

      acceptDualStateConfirm();
      expect(isDualStateConfirmPending()).toBe(false);

      // All teeth applied
      expect(__getToothStateForTest(14)!.toothSelection).toBe("implant");
      expect(__getToothStateForTest(12)!.toothSelection).toBe("implant");
      expect(__getToothStateForTest(16)!.toothSelection).toBe("none");

      // 14 diverges from plan (has plan diff)
      expect(getPlanChanges().some((c) => c.toothNo === 14)).toBe(true);
      // 12 (unplanned) mirrored status->plan, so has NO plan diff
      expect(getPlanChanges().some((c) => c.toothNo === 12)).toBe(false);
    });

    it("supports lower-arch bar-denture preset from STATUS_EXTRAS", () => {
      const lowerPreset = STATUS_EXTRAS.options.find((opt) => opt.id === "lower-bar-denture")!;
      expect(lowerPreset).toBeDefined();

      __applyStatusExtraForTest(lowerPreset);

      for (const tn of lowerPreset.implants!) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("implant");
        expect(s.prosthesis).toBe("bar-denture");
      }
      for (const tn of lowerPreset.missing!) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("bar-denture");
      }
      // 47, 48, 37, 38 end in 7/8
      for (const tn of [47, 48, 37, 38]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("none");
      }
      // Upper teeth remain untouched
      expect(__getToothStateForTest(11)!.toothSelection).toBe("tooth-base");
    });
  });

  // =========================================================================
  // 3. GAP-2: Full Removable
  // =========================================================================
  describe("GAP-2: Full Removable preset characterization", () => {
    it("upper full-removable: sets non-wisdom teeth to removable-full, wisdom teeth to none, leaves lower arch untouched", () => {
      __applyStatusExtraForTest({ type: "full-removable", arch: "upper" });

      const upperWisdom = [18, 28];
      const upperNonWisdom = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];

      for (const tn of upperNonWisdom) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("removable-full");
      }

      for (const tn of upperWisdom) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("none");
      }

      // Opposite (lower) arch is completely untouched
      for (const tn of [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("tooth-base");
        expect(s.prosthesis).toBe("none");
      }
    });

    it("lower full-removable: sets non-wisdom teeth to removable-full, wisdom teeth to none, leaves upper arch untouched", () => {
      __applyStatusExtraForTest({ type: "full-removable", arch: "lower" });

      const lowerWisdom = [48, 38];
      const lowerNonWisdom = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

      for (const tn of lowerNonWisdom) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("removable-full");
      }

      for (const tn of lowerWisdom) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("none");
        expect(s.prosthesis).toBe("none");
      }

      // Opposite (upper) arch is completely untouched
      for (const tn of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.toothSelection).toBe("tooth-base");
        expect(s.prosthesis).toBe("none");
      }
    });

    it("replaces existing clinical conditions with defaultState() rather than keeping old fields", () => {
      // Pre-populate tooth 14 and wisdom tooth 18 with crowns, fillings, broken surfaces
      __setToothStateForTest(14, {
        toothSelection: "tooth-base",
        restorationType: "crown",
        restorationMaterial: "gold",
        brokenDistal: true,
      });
      __setToothStateForTest(18, {
        toothSelection: "tooth-base",
        restorationType: "crown",
        restorationMaterial: "zircon",
        brokenMesial: true,
      });

      __applyStatusExtraForTest({ type: "full-removable", arch: "upper" });

      const s14 = __getToothStateForTest(14)!;
      expect(s14.toothSelection).toBe("none");
      expect(s14.prosthesis).toBe("removable-full");
      expect(s14.restorationType).toBe("none");
      expect(s14.brokenDistal).toBe(false);

      // Crucial: wisdom tooth 18 is ALSO reset to defaultState + toothSelection 'none' (NOT left untouched)
      const s18 = __getToothStateForTest(18)!;
      expect(s18.toothSelection).toBe("none");
      expect(s18.prosthesis).toBe("none");
      expect(s18.restorationType).toBe("none");
      expect(s18.brokenMesial).toBe(false);
    });

    it("gates dual-state confirmation when touching a plan-edited tooth in the arch", () => {
      planEditTooth(12);

      __applyStatusExtraForTest({ type: "full-removable", arch: "upper" });
      expect(isDualStateConfirmPending()).toBe(true);

      // Cancel keeps pre-edit state
      cancelDualStateConfirm();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(12)!.toothSelection).toBe("tooth-base");

      // Apply again and accept
      __applyStatusExtraForTest({ type: "full-removable", arch: "upper" });
      acceptDualStateConfirm();
      expect(__getToothStateForTest(12)!.toothSelection).toBe("none");
      expect(__getToothStateForTest(12)!.prosthesis).toBe("removable-full");
      expect(getPlanChanges().some((c) => c.toothNo === 12)).toBe(true);
      expect(getPlanChanges().some((c) => c.toothNo === 11)).toBe(false); // unplanned mirrored
    });
  });

  // =========================================================================
  // 4. GAP-3: Arch Bridge Fallback
  // =========================================================================
  describe("GAP-3: Arch Bridge Fallback branch characterization", () => {
    it("normal case (>= 2 present teeth): creates pillar crowns and pontics between first and last", () => {
      // Missing: 18..14, 12..22, 24..28; Present: strictly 13 and 23
      for (const tn of [18, 17, 16, 15, 14, 12, 11, 21, 22, 24, 25, 26, 27, 28]) {
        __setToothStateForTest(tn, { toothSelection: "none" });
      }
      __setToothStateForTest(13, { toothSelection: "tooth-base" });
      __setToothStateForTest(23, { toothSelection: "tooth-base" });

      __applyStatusExtraForTest({ type: "arch-bridge", arch: "upper", material: "zircon" });

      // 13 and 23 are bridge pillar crowns
      const s13 = __getToothStateForTest(13)!;
      expect(s13.restorationType).toBe("crown");
      expect(s13.restorationMaterial).toBe("zircon");
      expect(s13.toothSubstrate).toBe("crownprep");
      expect(s13.bridgePillar).toBe(true);

      const s23 = __getToothStateForTest(23)!;
      expect(s23.restorationType).toBe("crown");
      expect(s23.bridgePillar).toBe(true);

      // 12, 11, 21, 22 (between 13 and 23) become pontics
      for (const tn of [12, 11, 21, 22]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.restorationType).toBe("bridge");
        expect(s.restorationMaterial).toBe("zircon");
      }

      // 14..18 (outside between, before 13) remain none
      for (const tn of [14, 15, 16, 17, 18]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.restorationType).toBe("none");
      }

      // 24..28 (outside between, after 23) remain none
      for (const tn of [24, 25, 26, 27, 28]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.restorationType).toBe("none");
      }
    });

    it("fallback case (exactly 1 present tooth): assigns pillar crown to solitary tooth, NO pontics created", () => {
      // All upper teeth missing except solitary 13
      for (const tn of [18, 17, 16, 15, 14, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        __setToothStateForTest(tn, { toothSelection: "none" });
      }
      __setToothStateForTest(13, { toothSelection: "tooth-base" });

      __applyStatusExtraForTest({ type: "arch-bridge", arch: "upper", material: "zircon" });

      // Solitary present tooth receives crown prep + bridge pillar
      const s13 = __getToothStateForTest(13)!;
      expect(s13.restorationType).toBe("crown");
      expect(s13.restorationMaterial).toBe("zircon");
      expect(s13.toothSubstrate).toBe("crownprep");
      expect(s13.bridgePillar).toBe(true);
      expect(s13.brokenMesial).toBe(false);
      expect(s13.brokenIncisal).toBe(false);
      expect(s13.brokenDistal).toBe(false);

      // CRITICAL: NO pontics created on any of the missing teeth in the fallback branch
      for (const tn of [17, 16, 15, 14, 12, 11, 21, 22, 23, 24, 25, 26, 27]) {
        const s = __getToothStateForTest(tn)!;
        expect(s.restorationType).toBe("none");
        expect(s.bridgePillar).toBe(false);
      }
    });

    it("fallback case (0 present teeth): commits 0 changes, leaves teeth unchanged", () => {
      // All upper teeth missing
      for (const tn of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        __setToothStateForTest(tn, { toothSelection: "none" });
      }

      __applyStatusExtraForTest({ type: "arch-bridge", arch: "upper", material: "zircon" });

      // Zero teeth changed, all still restorationType 'none'
      for (const tn of [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        expect(__getToothStateForTest(tn)!.restorationType).toBe("none");
      }
    });

    it("fallback case with solitary wisdom tooth (18/28): wisdom exclusion skips it, 0 changes committed", () => {
      // Only 18 is tooth-base
      for (const tn of [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        __setToothStateForTest(tn, { toothSelection: "none" });
      }
      __setToothStateForTest(18, { toothSelection: "tooth-base" });

      __applyStatusExtraForTest({ type: "arch-bridge", arch: "upper", material: "zircon" });

      // Wisdom tooth 18 is excluded by wisdom check
      expect(__getToothStateForTest(18)!.restorationType).toBe("none");
      expect(__getToothStateForTest(18)!.bridgePillar).toBe(false);
    });

    it("material mapping: 'metal' maps to 'metal-ceramic' on pillar crowns in fallback", () => {
      for (const tn of [18, 17, 16, 15, 14, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        __setToothStateForTest(tn, { toothSelection: "none" });
      }
      __setToothStateForTest(13, { toothSelection: "tooth-base" });

      __applyStatusExtraForTest({ type: "arch-bridge", arch: "upper", material: "metal" });

      expect(__getToothStateForTest(13)!.restorationMaterial).toBe("metal-ceramic");
    });

    it("plan mode marking in fallback: only the single crowned tooth is marked plan-edited", () => {
      for (const tn of [18, 17, 16, 15, 14, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]) {
        __setToothStateForTest(tn, { toothSelection: "none" });
      }
      __setToothStateForTest(13, { toothSelection: "tooth-base" });

      setChartMode("plan");
      __applyStatusExtraForTest({ type: "arch-bridge", arch: "upper", material: "zircon" });

      expect(__planEditedTeethForTest()).toContain(13);
      expect(__planEditedTeethForTest()).not.toContain(12);
      expect(__planEditedTeethForTest()).not.toContain(14);
      setChartMode("status");
    });
  });

  // =========================================================================
  // 5. GAP-4: Primary Dentition Preset (applyPrimaryDentition)
  // =========================================================================
  describe("GAP-4: Primary Dentition Preset characterization", () => {
    it("sets PRIMARY_MILK positions to milktooth and others to none", () => {
      applyPrimaryDentition();

      for (const tn of ALL_TEETH) {
        const s = __getToothStateForTest(tn)!;
        if (PRIMARY_MILK.has(tn)) {
          expect(s.toothSelection).toBe("milktooth");
        } else {
          expect(s.toothSelection).toBe("none");
        }
        expect(s.prosthesis).toBe("none");
        expect(s.restorationType).toBe("none");
      }
      expect(getStatusChart().globals.edentulous).toBe(false);
    });

    it("status mode with uninitialized plan: applies immediately without confirmation", () => {
      applyPrimaryDentition();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(11)!.toothSelection).toBe("milktooth");
    });

    it("status mode with initialized plan (unplanned teeth): mirrors all changed teeth with 0 plan diffs", () => {
      setChartMode("plan");
      setChartMode("status"); // plan initialized, 0 planned teeth

      applyPrimaryDentition();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(11)!.toothSelection).toBe("milktooth");
      expect(getPlanChanges().length).toBe(0); // all mirrored
    });

    it("status mode with plan-edited teeth: exactly ONE confirm modal, cancels and accepts cleanly", () => {
      planEditTooth(11); // 11 is in PRIMARY_MILK
      planEditTooth(16); // 16 is in non-primary

      applyPrimaryDentition();

      // Exactly ONE confirm for the whole batch
      expect(isDualStateConfirmPending()).toBe(true);

      // Pre-confirm teeth unchanged
      expect(__getToothStateForTest(11)!.toothSelection).toBe("tooth-base");
      expect(__getToothStateForTest(16)!.toothSelection).toBe("tooth-base");

      // Cancel leaves state untouched
      cancelDualStateConfirm();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(11)!.toothSelection).toBe("tooth-base");
      expect(__getToothStateForTest(16)!.toothSelection).toBe("tooth-base");

      // Re-apply and accept
      applyPrimaryDentition();
      expect(isDualStateConfirmPending()).toBe(true);
      acceptDualStateConfirm();
      expect(isDualStateConfirmPending()).toBe(false);

      // Applied: 11 is milktooth, 16 is none
      expect(__getToothStateForTest(11)!.toothSelection).toBe("milktooth");
      expect(__getToothStateForTest(16)!.toothSelection).toBe("none");

      // Planned teeth diverge from plan
      expect(getPlanChanges().some((c) => c.toothNo === 11)).toBe(true);
      expect(getPlanChanges().some((c) => c.toothNo === 16)).toBe(true);
      // Unplanned teeth mirrored
      expect(getPlanChanges().some((c) => c.toothNo === 12)).toBe(false);
    });

    it("plan mode: applies directly and marks only changed teeth", () => {
      setChartMode("plan");
      applyPrimaryDentition();
      expect(isDualStateConfirmPending()).toBe(false);

      // Every tooth whose target differed from initial default state was marked
      expect(__planEditedTeethForTest().length).toBeGreaterThan(0);
      setChartMode("status");
    });

    it("distinguishes changed teeth passed to gate vs commit callback replacing all 32 teeth", () => {
      // Set tooth 11 already to defaultState + milktooth (target state)
      const target11 = defaultState();
      target11.toothSelection = "milktooth";
      __setToothStateForTest(11, target11);

      // Tooth 11 is NOT in changed filter because its serialized state matches targetFor(11)
      setChartMode("plan");
      applyPrimaryDentition();

      // In plan mode, gate adds only changed teeth to planEditedTeeth. 11 was NOT in changed!
      expect(__planEditedTeethForTest()).not.toContain(11);
      // But tooth 12 WAS in changed
      expect(__planEditedTeethForTest()).toContain(12);

      // But inside commit callback, ALL_TEETH was iterated, so 11 still holds targetFor(11)
      expect(__getToothStateForTest(11)!.toothSelection).toBe("milktooth");
      setChartMode("status");
    });

    it("preserves edentulous=true on Cancel, flips to edentulous=false on Accept", () => {
      __setEdentulousForTest(true);
      planEditTooth(15); // PRIMARY_MILK tooth planned

      applyPrimaryDentition();
      expect(isDualStateConfirmPending()).toBe(true);

      // Cancel leaves edentulous=true
      cancelDualStateConfirm();
      expect(getStatusChart().globals.edentulous).toBe(true);

      // Accept flips edentulous to false
      applyPrimaryDentition();
      acceptDualStateConfirm();
      expect(getStatusChart().globals.edentulous).toBe(false);
    });
  });

  // =========================================================================
  // 6. GAP-5: Mixed Dentition Preset (applyMixedDentition)
  // =========================================================================
  describe("GAP-5: Mixed Dentition Preset characterization", () => {
    it("sets MIXED_PERMANENT to tooth-base, MIXED_MILK to milktooth, MIXED_NONE to none", () => {
      applyMixedDentition();

      for (const tn of ALL_TEETH) {
        const s = __getToothStateForTest(tn)!;
        if (MIXED_PERMANENT.has(tn)) {
          expect(s.toothSelection).toBe("tooth-base");
        } else if (MIXED_MILK.has(tn)) {
          expect(s.toothSelection).toBe("milktooth");
        } else if (MIXED_NONE.has(tn)) {
          expect(s.toothSelection).toBe("none");
        }
        expect(s.prosthesis).toBe("none");
        expect(s.restorationType).toBe("none");
      }
      expect(getStatusChart().globals.edentulous).toBe(false);
    });

    it("status mode with uninitialized plan: applies immediately without confirmation", () => {
      applyMixedDentition();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(13)!.toothSelection).toBe("milktooth");
      expect(__getToothStateForTest(11)!.toothSelection).toBe("tooth-base");
    });

    it("status mode with initialized plan: mirrors all changed teeth with 0 plan diffs", () => {
      setChartMode("plan");
      setChartMode("status");

      applyMixedDentition();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(getPlanChanges().length).toBe(0);
    });

    it("status mode with plan-edited teeth: confirms once, cancels and accepts cleanly", () => {
      planEditTooth(13); // MIXED_MILK
      planEditTooth(17); // MIXED_NONE

      applyMixedDentition();
      expect(isDualStateConfirmPending()).toBe(true);

      cancelDualStateConfirm();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(13)!.toothSelection).toBe("tooth-base");

      applyMixedDentition();
      acceptDualStateConfirm();
      expect(isDualStateConfirmPending()).toBe(false);
      expect(__getToothStateForTest(13)!.toothSelection).toBe("milktooth");
      expect(__getToothStateForTest(17)!.toothSelection).toBe("none");

      expect(getPlanChanges().some((c) => c.toothNo === 13)).toBe(true);
      expect(getPlanChanges().some((c) => c.toothNo === 17)).toBe(true);
      expect(getPlanChanges().some((c) => c.toothNo === 14)).toBe(false); // unplanned mirrored
    });

    it("plan mode: applies directly and marks changed teeth", () => {
      setChartMode("plan");
      applyMixedDentition();
      expect(isDualStateConfirmPending()).toBe(false);
      // Permanent teeth like 11 were already tooth-base, so they were NOT changed
      expect(__planEditedTeethForTest()).not.toContain(11);
      // Milktooth position 13 was changed from tooth-base to milktooth
      expect(__planEditedTeethForTest()).toContain(13);
      // None position 17 was changed from tooth-base to none
      expect(__planEditedTeethForTest()).toContain(17);
      setChartMode("status");
    });

    it("preserves edentulous=true on Cancel, flips to edentulous=false on Accept", () => {
      __setEdentulousForTest(true);
      planEditTooth(13);

      applyMixedDentition();
      expect(isDualStateConfirmPending()).toBe(true);

      cancelDualStateConfirm();
      expect(getStatusChart().globals.edentulous).toBe(true);

      applyMixedDentition();
      acceptDualStateConfirm();
      expect(getStatusChart().globals.edentulous).toBe(false);
    });

    it("__applyDentitionPresetForTest forwards correctly for primary and mixed", () => {
      __applyDentitionPresetForTest("primary");
      expect(__getToothStateForTest(11)!.toothSelection).toBe("milktooth");

      __applyDentitionPresetForTest("mixed");
      expect(__getToothStateForTest(11)!.toothSelection).toBe("tooth-base");
    });
  });

  // =========================================================================
  // 7. Additional Regression Scenarios
  // =========================================================================
  describe("Additional Regression Scenarios", () => {
    describe("A. Idempotent Reapplication", () => {
      it("primary dentition applied twice produces identical plain state and fires notification without confirm", () => {
        applyPrimaryDentition();
        const firstRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));

        // Plan-edit tooth 11 in plan mode (so plan differs, but tooth 11 in status remains matching primary target)
        setChartMode("plan");
        setPerioSite(11, "MB", { pd: 6 });
        expect(__planEditedTeethForTest()).toContain(11);
        setChartMode("status");

        // Apply primary dentition second time: tooth 11 in status is ALREADY milktooth (target state),
        // so changed is empty (changed.length === 0).
        const spy = vi.fn();
        const off = onStateChange(spy);

        applyPrimaryDentition();

        // No confirmation triggered because changed.length === 0
        expect(isDualStateConfirmPending()).toBe(false);

        // Implementation fires notifyStateChange() inside callback even when changed is empty
        expect(spy).toHaveBeenCalled();
        off();

        // States match
        const secondRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));
        expect(secondRunStates).toEqual(firstRunStates);
      });

      it("mixed dentition applied twice produces identical plain state and fires notification", () => {
        applyMixedDentition();
        const firstRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));

        const spy = vi.fn();
        const off = onStateChange(spy);
        applyMixedDentition();

        expect(isDualStateConfirmPending()).toBe(false);
        expect(spy).toHaveBeenCalled();
        off();

        const secondRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));
        expect(secondRunStates).toEqual(firstRunStates);
      });

      it("full-removable applied twice produces identical plain state", () => {
        __applyStatusExtraForTest({ type: "full-removable", arch: "upper" });
        const firstRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));

        const spy = vi.fn();
        const off = onStateChange(spy);
        __applyStatusExtraForTest({ type: "full-removable", arch: "upper" });

        expect(isDualStateConfirmPending()).toBe(false);
        expect(spy).toHaveBeenCalled();
        off();

        const secondRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));
        expect(secondRunStates).toEqual(firstRunStates);
      });

      it("bar-denture applied twice produces identical plain state", () => {
        const option = {
          type: "bar-denture",
          arch: "upper",
          implants: [14, 12, 22, 24],
          missing: [16, 15, 13, 11, 21, 23, 25, 26],
        };
        __applyStatusExtraForTest(option);
        const firstRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));

        const spy = vi.fn();
        const off = onStateChange(spy);
        __applyStatusExtraForTest(option);

        expect(isDualStateConfirmPending()).toBe(false);
        expect(spy).toHaveBeenCalled();
        off();

        const secondRunStates = ALL_TEETH.map((tn) => __getToothStateForTest(tn));
        expect(secondRunStates).toEqual(firstRunStates);
      });
    });

    describe("B. setEdentulous(true/false)", () => {
      it("setEdentulous(true): defers confirm when a tooth is planned, cancels safely, accepts and sets all 32 teeth to none", () => {
        planEditTooth(16);

        setEdentulous(true);
        expect(isDualStateConfirmPending()).toBe(true);

        // Cancel leaves edentulous=false and 16 unchanged
        cancelDualStateConfirm();
        expect(isDualStateConfirmPending()).toBe(false);
        expect(getStatusChart().globals.edentulous).not.toBe(true);
        expect(__getToothStateForTest(16)!.toothSelection).toBe("tooth-base");

        // Accept sets edentulous=true and all 32 teeth to none
        setEdentulous(true);
        acceptDualStateConfirm();
        expect(getStatusChart().globals.edentulous).toBe(true);
        for (const tn of ALL_TEETH) {
          expect(__getToothStateForTest(tn)!.toothSelection).toBe("none");
        }
      });

      it("setEdentulous(true): omits already sound-missing teeth from changed (no-op signaling)", () => {
        // Tooth 16 is already sound-missing in status
        __setToothStateForTest(16, { toothSelection: "none" });

        // In Plan mode, tooth 16 is planned via perio site
        setChartMode("plan");
        setPerioSite(16, "MB", { pd: 6 });
        expect(__planEditedTeethForTest()).toContain(16);
        setChartMode("status");

        // In status mode, tooth 16 is still sound-missing with no status probing (matches missingKey).
        // Since ONLY tooth 16 was plan-edited, and tooth 16 in status is ALREADY sound-missing,
        // tooth 16 is NOT in changed!
        // Therefore, setEdentulous(true) in status mode does NOT trigger a confirm modal!
        __setEdentulousForTest(true);

        expect(isDualStateConfirmPending()).toBe(false);
        expect(getStatusChart().globals.edentulous).toBe(true);

        // And in plan mode, tooth 16's planned probing is untouched (not overwritten)!
        setChartMode("plan");
        expect(getToothPerio(16).pd.MB).toBe(6);
        setChartMode("status");
      });

      it("setEdentulous(false): immediate un-gated behavior without confirm dialog, leaves teeth untouched", () => {
        setEdentulous(true);

        // Plan-edit tooth 16
        planEditTooth(16);

        // Disabling edentulous is never gated
        setEdentulous(false);

        expect(isDualStateConfirmPending()).toBe(false);
        expect(getStatusChart().globals.edentulous).toBe(false);
        // Tooth 16 remains in its current state (not modified by setEdentulous(false))
        expect(__getToothStateForTest(16)!.toothSelection).toBe("none");
      });
    });

    describe("C. resetMouth()", () => {
      it("imperative blank-slate reset: un-gated, clears edentulous, clears case metadata, resets all 32 teeth", () => {
        // Setup complex state: edentulous, case metadata, modified teeth, planned teeth
        __setEdentulousForTest(true);
        setCaseAge(55);
        expect(getCaseMeta().age).toBe(55);

        __setToothStateForTest(11, { restorationType: "crown", restorationMaterial: "zircon" });
        planEditTooth(11);

        const spy = vi.fn();
        const off = onStateChange(spy);

        // resetMouth() is an un-gated imperative blank slate
        resetMouth();

        // Never requests dual-state confirmation
        expect(isDualStateConfirmPending()).toBe(false);

        // Edentulous is cleared
        expect(getStatusChart().globals.edentulous).toBe(false);

        // Case metadata is cleared
        expect(getCaseMeta().age).toBeNull();

        // All 32 teeth are reset to clean defaultState
        for (const tn of ALL_TEETH) {
          const s = __getToothStateForTest(tn)!;
          expect(s.toothSelection).toBe("tooth-base");
          expect(s.restorationType).toBe("none");
          expect(s.prosthesis).toBe("none");
        }

        // Fired notifyStateChange
        expect(spy).toHaveBeenCalled();
        off();
      });

      it("resetMouth() preserves the original number and order of notifications, including setEdentulous(false)", () => {
        // Setup edentulous=true and case metadata
        __setEdentulousForTest(true);
        setCaseAge(60);

        const calls: { edentulous: boolean; age: number | null }[] = [];
        const off = onStateChange(() => {
          calls.push({
            edentulous: getStatusChart().globals.edentulous,
            age: getCaseMeta().age,
          });
        });

        resetMouth();
        off();

        // Exactly 2 notifications:
        // Call 1: from setEdentulous(false) -> edentulous is false, but caseMeta (age 60) not yet cleared
        // Call 2: from resetMouth() final notify -> edentulous is false, caseMeta (age null) is cleared
        expect(calls.length).toBe(2);
        expect(calls[0]).toEqual({ edentulous: false, age: 60 });
        expect(calls[1]).toEqual({ edentulous: false, age: null });
      });
    });

    describe("D. Status Preset Target State No-Op Signaling (Section 8 Ambiguity 1)", () => {
      it("applyStatusExtra: plan-edited tooth already in target status state does not trigger confirmation", () => {
        // Tooth 14 is pre-set to implant / bar-denture in status
        const preState = defaultState();
        preState.toothSelection = "implant";
        preState.prosthesis = "bar-denture";
        __setToothStateForTest(14, preState);

        // In Plan mode, tooth 14 is plan-edited via perio site
        setChartMode("plan");
        setPerioSite(14, "MB", { pd: 6 });
        expect(__planEditedTeethForTest()).toContain(14);
        setChartMode("status");

        // In Status mode, tooth 14 already matches the target candidate state of bar-denture implants [14].
        const option = {
          type: "bar-denture",
          arch: "upper",
          implants: [14],
          missing: [],
        };
        // Pre-set sevenEight teeth [17, 18, 27, 28] to candidate state (none, none) so they are also unchanged
        for (const tn of [17, 18, 27, 28]) {
          const s = defaultState();
          s.toothSelection = "none";
          s.prosthesis = "none";
          __setToothStateForTest(tn, s);
        }

        // Apply preset
        __applyStatusExtraForTest(option);

        // No confirmation dialog should be pending because changed array is empty
        expect(isDualStateConfirmPending()).toBe(false);

        // Tooth 14 planned perio probing is preserved intact
        setChartMode("plan");
        expect(getToothPerio(14).pd.MB).toBe(6);
        setChartMode("status");
      });

      it("applyStatusExtra: batch containing a plan-edited tooth already in target state plus unplanned changed teeth does not trigger confirmation", () => {
        // Tooth 14 is plan-edited but already matches target state
        const preState = defaultState();
        preState.toothSelection = "implant";
        preState.prosthesis = "bar-denture";
        __setToothStateForTest(14, preState);

        setChartMode("plan");
        setPerioSite(14, "MB", { pd: 6 });
        expect(__planEditedTeethForTest()).toContain(14);
        setChartMode("status");

        // Tooth 12 is unplanned (normal baseline)
        expect(__planEditedTeethForTest()).not.toContain(12);

        const option = {
          type: "bar-denture",
          arch: "upper",
          implants: [14, 12],
          missing: [],
        };
        for (const tn of [17, 18, 27, 28]) {
          const s = defaultState();
          s.toothSelection = "none";
          s.prosthesis = "none";
          __setToothStateForTest(tn, s);
        }

        __applyStatusExtraForTest(option);

        // Tooth 12 changed, but 12 is UNPLANNED. Tooth 14 is PLANNED, but 14 did NOT change.
        // Therefore changed = [12]. Since 12 is not plan-edited, no confirmation is triggered!
        expect(isDualStateConfirmPending()).toBe(false);
        expect(__getToothStateForTest(12)!.toothSelection).toBe("implant");
        expect(__getToothStateForTest(14)!.toothSelection).toBe("implant");
      });
    });
  });
});
