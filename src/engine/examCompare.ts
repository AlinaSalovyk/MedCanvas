import { ALL_TEETH } from "@/anatomy/profiles";
import { t } from "@/i18n/useI18n";
import { optionsFor } from "@/registry/uiOptions";
import { PROSTHESIS_SUMMARY_KEY, SUMMARY_ENDO_KEY } from "@/engine/constants";
import { restorationSummaryLabel } from "@/engine/clinicalOptions";
import { pulpDiagnosisLabel, apicalDiagnosisLabel } from "@/engine/clinicalSummary";
import { charts, planInitialized } from "@/state/chart";
import { defaultState, hydrateState, isLegacyPayloadVersion } from "@/state/payload";
import { comparePerioExams } from "@/state/examCompare";
import { computeFinalClassification } from "@/fhir/toFhirPerio";
import type { OdontogramExportPayload } from "@/fhir/types";
import type { PlanChange, ExamComparison, Any } from "@/engine/types";

const TOOTH_SELECT_LABEL_KEY: Record<string, string> = Object.fromEntries(
  optionsFor("toothSelection").map((o) => [o.value, o.labelKey]),
);

function perioSummaryLabel(s: Any): string {
  const perio = s.perio;
  if (!perio || !perio.pd || perio.pd.size === 0) return t("planChange.none");
  let bleeding = 0;
  let worstCal: number | null = null;
  for (const [site, pd] of perio.pd as Map<string, number>) {
    if ((perio.bop as Set<string>).has(site)) bleeding++;
    const cal = pd + ((perio.gm as Map<string, number>).get(site) ?? 0);
    if (worstCal === null || cal > worstCal) worstCal = cal;
  }
  const bopPct = Math.round((bleeding / perio.pd.size) * 1000) / 10;
  return t("planChange.perioSummary", { sites: perio.pd.size, bop: bopPct, cal: worstCal ?? 0 });
}

function furcationSummaryLabel(s: Any): string {
  const furcation = s.furcation as Map<string, number> | undefined;
  if (!furcation || furcation.size === 0) return t("planChange.none");
  let maxGrade = 0;
  for (const grade of furcation.values()) {
    if (grade > maxGrade) maxGrade = grade;
  }
  return maxGrade > 0 ? t(`furcation.grade.${maxGrade}`) : t("planChange.none");
}

function plaqueSummaryLabel(s: Any): string {
  const plaque = s.plaque as Set<string> | undefined;
  if (!plaque || plaque.size === 0) return t("planChange.none");
  return `${plaque.size}/4`;
}

export const DIFF_AXES: { key: string; labelKey: string; label: (s: Any) => string }[] = [
  {
    key: "presence",
    labelKey: "planChange.axis.presence",
    label: (s) => {
      const base = t(TOOTH_SELECT_LABEL_KEY[s.toothSelection] ?? "toothSelect.none");
      return s.extractionPlan ? `${base} (${t("tooth.extractionPlan")})` : base;
    },
  },
  {
    key: "substrate",
    labelKey: "planChange.axis.substrate",
    label: (s) => t(`substrate.${s.toothSubstrate}`),
  },
  {
    key: "restoration",
    labelKey: "planChange.axis.restoration",
    label: (s) =>
      s.restorationType === "none"
        ? t("planChange.none")
        : restorationSummaryLabel(s.restorationType, s.restorationMaterial),
  },
  {
    key: "prosthesis",
    labelKey: "planChange.axis.prosthesis",
    label: (s) => {
      const prosthesisKey = PROSTHESIS_SUMMARY_KEY[s.prosthesis];
      return prosthesisKey ? t(prosthesisKey) : t("planChange.none");
    },
  },
  {
    key: "crownAction",
    labelKey: "planChange.axis.crownAction",
    label: (s) => {
      const parts: string[] = [];
      if (s.crownNeeded) parts.push(t("tooth.crownNeeded"));
      if (s.crownReplace) parts.push(t("tooth.crownReplace"));
      return parts.length > 0 ? parts.join(", ") : t("planChange.none");
    },
  },
  {
    key: "ortho",
    labelKey: "planChange.axis.ortho",
    label: (s) => {
      const parts: string[] = [];
      if (s.orthoAppliance && s.orthoAppliance !== "none") parts.push(t("ortho.appliance." + s.orthoAppliance));
      if (s.orthoDrift && s.orthoDrift !== "none") parts.push(t("ortho.drift." + s.orthoDrift));
      if (s.orthoVertical && s.orthoVertical !== "none") parts.push(t("ortho.vertical." + s.orthoVertical));
      if (s.orthoRotation === true) parts.push(t("ortho.rotation.label"));
      return parts.length > 0 ? parts.join(", ") : t("planChange.none");
    },
  },
  {
    key: "pulpEndo",
    labelKey: "planChange.axis.pulpEndo",
    label: (s) => {
      if (s.endo && s.endo !== "none") {
        const endoKey = SUMMARY_ENDO_KEY[s.endo];
        return endoKey ? t(endoKey) : t("planChange.none");
      }
      return pulpDiagnosisLabel(s) ?? t("planChange.none");
    },
  },
  {
    key: "apical",
    labelKey: "planChange.axis.apical",
    label: (s) => apicalDiagnosisLabel(s) ?? t("planChange.none"),
  },
  {
    key: "perio",
    labelKey: "planChange.axis.perio",
    label: (s) => perioSummaryLabel(s),
  },
  {
    key: "furcation",
    labelKey: "planChange.axis.furcation",
    label: (s) => furcationSummaryLabel(s),
  },
  {
    key: "plaque",
    labelKey: "planChange.axis.plaque",
    label: (s) => plaqueSummaryLabel(s),
  },
];

export function diffChartsByAxis(
  before: (toothNo: number) => Any,
  after: (toothNo: number) => Any,
): PlanChange[] {
  const out: PlanChange[] = [];
  for (const toothNo of ALL_TEETH) {
    const a = before(toothNo);
    const b = after(toothNo);
    for (const axis of DIFF_AXES) {
      const from = axis.label(a);
      const to = axis.label(b);
      if (from !== to) out.push({ toothNo, axis: axis.key, from, to });
    }
  }
  return out;
}

export function getPlanChanges(): PlanChange[] {
  if (!planInitialized) return [];
  return diffChartsByAxis(
    (toothNo) => charts.status.get(toothNo) ?? defaultState(),
    (toothNo) => charts.plan.get(toothNo) ?? defaultState(),
  );
}

export function compareExams(before: Any, after: Any): ExamComparison {
  const reader = (payload: Any) => {
    const teeth =
      payload && typeof payload === "object" && payload.teeth && typeof payload.teeth === "object"
        ? (payload.teeth as Record<string, Any>)
        : {};
    const legacy = isLegacyPayloadVersion(payload?.version);
    return (toothNo: number) => {
      const raw = teeth[String(toothNo)];
      return raw && typeof raw === "object" ? hydrateState(raw, legacy) : defaultState();
    };
  };
  return {
    changes: diffChartsByAxis(reader(before), reader(after)),
    perio: comparePerioExams(before, after),
    classification: {
      from: computeFinalClassification(before as OdontogramExportPayload),
      to: computeFinalClassification(after as OdontogramExportPayload),
    },
  };
}
