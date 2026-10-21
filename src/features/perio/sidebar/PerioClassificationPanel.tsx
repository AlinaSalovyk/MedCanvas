import React from "react";
import { t } from "@/i18n/useI18n";
import {
  setDiagnosisOverride,
  setStageOverride,
  setGradeOverride,
  setExtentOverride,
} from "@/odontogram";
import { type CaseMetaData, type ClassificationData } from "./types";

function diagnosisLabel(v: string): string {
  return t(`perio.class.dx.${v}`);
}
function stageLabel(v: string): string {
  if (v === "na") return t("perio.class.stage.na");
  if (v === "indeterminate") return t("perio.class.stage.indeterminate");
  return t(`perio.class.stage.${v}`);
}
function gradeLabel(v: string): string {
  if (v === "indeterminate") return t("perio.class.grade.indeterminate");
  return t(`perio.class.grade.${v}`);
}
function extentLabel(v: string): string {
  if (v === "na") return t("perio.class.extent.na");
  if (v === "molar-incisor") return t("perio.class.extent.molarIncisor");
  return t(`perio.class.extent.${v}`);
}

export interface PerioClassificationPanelProps {
  classification: ClassificationData;
  caseMeta: CaseMetaData;
  readOnly: boolean;
}

export function PerioClassificationPanel({
  classification,
  caseMeta,
  readOnly,
}: PerioClassificationPanelProps): React.ReactElement {
  return (
    <>
      <div className="case-meta-panel-subheading">{t("perio.class.title")}</div>
      <div className="perio-class-row">
        <label className="perio-class-row-label" htmlFor="perioClassDiagnosisOverride">
          {t("perio.class.diagnosis")}
        </label>
        <div className="perio-class-derived" id="perioClassDiagnosisDerived">
          {diagnosisLabel(classification.derived.diagnosis)}
        </div>
        <select
          id="perioClassDiagnosisOverride"
          className="odon-settings-select case-meta-select"
          disabled={readOnly}
          value={caseMeta.diagnosisOverride ?? ""}
          onChange={(e) => setDiagnosisOverride(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">
            {t("perio.class.useDerived", { value: diagnosisLabel(classification.derived.diagnosis) })}
          </option>
          <option value="health">{t("perio.class.dx.health")}</option>
          <option value="gingivitis">{t("perio.class.dx.gingivitis")}</option>
          <option value="periodontitis">{t("perio.class.dx.periodontitis")}</option>
        </select>
      </div>
      <div className="perio-class-row">
        <label className="perio-class-row-label" htmlFor="perioClassStageOverride">
          {t("perio.class.stage")}
        </label>
        <div className="perio-class-derived" id="perioClassStageDerived">
          {stageLabel(classification.derived.stage)}
        </div>
        <select
          id="perioClassStageOverride"
          className="odon-settings-select case-meta-select"
          disabled={readOnly}
          value={caseMeta.stageOverride ?? ""}
          onChange={(e) => setStageOverride(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">
            {t("perio.class.useDerived", { value: stageLabel(classification.derived.stage) })}
          </option>
          <option value="I">{t("perio.class.stage.I")}</option>
          <option value="II">{t("perio.class.stage.II")}</option>
          <option value="III">{t("perio.class.stage.III")}</option>
          <option value="IV">{t("perio.class.stage.IV")}</option>
        </select>
      </div>
      <div className="perio-class-row">
        <label className="perio-class-row-label" htmlFor="perioClassGradeOverride">
          {t("perio.class.grade")}
        </label>
        <div className="perio-class-derived" id="perioClassGradeDerived">
          {gradeLabel(classification.derived.grade)}
        </div>
        <select
          id="perioClassGradeOverride"
          className="odon-settings-select case-meta-select"
          disabled={readOnly}
          value={caseMeta.gradeOverride ?? ""}
          onChange={(e) => setGradeOverride(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">
            {t("perio.class.useDerived", { value: gradeLabel(classification.derived.grade) })}
          </option>
          <option value="A">{t("perio.class.grade.A")}</option>
          <option value="B">{t("perio.class.grade.B")}</option>
          <option value="C">{t("perio.class.grade.C")}</option>
        </select>
      </div>
      <div className="perio-class-row">
        <label className="perio-class-row-label" htmlFor="perioClassExtentOverride">
          {t("perio.class.extent")}
        </label>
        <div className="perio-class-derived" id="perioClassExtentDerived">
          {extentLabel(classification.derived.extent)}
        </div>
        <select
          id="perioClassExtentOverride"
          className="odon-settings-select case-meta-select"
          disabled={readOnly}
          value={caseMeta.extentOverride ?? ""}
          onChange={(e) => setExtentOverride(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">
            {t("perio.class.useDerived", { value: extentLabel(classification.derived.extent) })}
          </option>
          <option value="localized">{t("perio.class.extent.localized")}</option>
          <option value="generalized">{t("perio.class.extent.generalized")}</option>
          <option value="molar-incisor">{t("perio.class.extent.molarIncisor")}</option>
        </select>
      </div>
    </>
  );
}
