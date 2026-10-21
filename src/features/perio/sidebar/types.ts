import { getPerioSummary, getCaseMeta, getPerioClassification } from "@/odontogram";

export type PerioSummaryData = ReturnType<typeof getPerioSummary>;
export const EMPTY_SUMMARY: PerioSummaryData = {
  chartedSites: 0,
  bleedingSites: 0,
  bopPercent: 0,
  worstCal: null,
  worstCalTooth: null,
  maxPd: null,
  avgPd: null,
  avgCal: null,
  maxFurcation: null,
  plaquePercent: 0,
  piScore: null,
  giScore: null,
  kgDeficientTeeth: 0,
  gtDistribution: { thin: 0, medium: 0, thick: 0 },
  millerDistribution: { i: 0, ii: 0, iii: 0, iv: 0 },
  mpiScore: null,
  mbiScore: null,
};

export type CaseMetaData = ReturnType<typeof getCaseMeta>;
export const EMPTY_CASE_META: CaseMetaData = {
  age: null,
  smokingStatus: "unknown",
  cigarettesPerDay: null,
  diabetesStatus: "unknown",
  hba1c: null,
  toothLossPerio: null,
  maxRblPercent: null,
  diagnosisOverride: null,
  stageOverride: null,
  gradeOverride: null,
  extentOverride: null,
  patientName: null,
  patientDob: null,
  examDate: null,
  caseConditions: new Map(),
};

export type ClassificationData = ReturnType<typeof getPerioClassification>;
export const EMPTY_CLASSIFICATION: ClassificationData = {
  diagnosis: "health",
  stage: "na",
  grade: "indeterminate",
  extent: "na",
  derived: {
    diagnosis: "health",
    stage: "na",
    grade: "indeterminate",
    extent: "na",
    buckets: { smoking: "A", diabetes: "A", direct: null },
  },
  overridden: { diagnosis: false, stage: false, grade: false, extent: false },
};

// Glickman furcation grade -> Roman-numeral face (mirrors PerioChart.tsx FURCATION_ROMAN)
export const FURCATION_ROMAN = ["–", "I", "II", "III", "IV"];
