import React from "react";
import { t } from "@/i18n/useI18n";
import {
  setPatientName,
  setExamDate,
  setCaseAge,
  setSmokingStatus,
  setCigarettesPerDay,
  setDiabetesStatus,
  setHba1c,
  setMaxRblPercent,
  setToothLossPerio,
} from "@/odontogram";
import { type CaseMetaData } from "./types";

export interface CaseMetaFormProps {
  caseMeta: CaseMetaData;
  readOnly: boolean;
}

export function CaseMetaForm({ caseMeta, readOnly }: CaseMetaFormProps): React.ReactElement {
  const cigsDisabled = caseMeta.smokingStatus !== "current";
  const hba1cDisabled = caseMeta.diabetesStatus !== "present";

  return (
    <>
      <div className="case-meta-row">
        <label className="case-meta-row-label" htmlFor="caseMetaPatientName">
          {t("case.patientName")}
        </label>
        <input
          id="caseMetaPatientName"
          className="case-meta-input"
          type="text"
          disabled={readOnly}
          value={caseMeta.patientName ?? ""}
          onChange={(e) => setPatientName(e.target.value === "" ? null : e.target.value)}
        />
      </div>
      <div className="case-meta-row">
        <label className="case-meta-row-label" htmlFor="caseMetaExamDate">
          {t("case.examDate")}
        </label>
        <input
          id="caseMetaExamDate"
          className="case-meta-input"
          type="date"
          disabled={readOnly}
          value={caseMeta.examDate ?? ""}
          onChange={(e) => setExamDate(e.target.value === "" ? null : e.target.value)}
        />
      </div>
      <div className="case-meta-row">
        <label className="case-meta-row-label" htmlFor="caseMetaAge">
          {t("case.age")}
        </label>
        <input
          id="caseMetaAge"
          className="case-meta-input case-meta-input-narrow"
          type="number"
          min={0}
          max={120}
          disabled={readOnly}
          value={caseMeta.age ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setCaseAge(v === "" ? null : Number(v));
          }}
        />
      </div>
      <div className="case-meta-row">
        <label className="case-meta-row-label" htmlFor="caseMetaSmoking">
          {t("case.smoking.label")}
        </label>
        <select
          id="caseMetaSmoking"
          className="odon-settings-select case-meta-select"
          disabled={readOnly}
          value={caseMeta.smokingStatus}
          onChange={(e) => setSmokingStatus(e.target.value)}
        >
          <option value="unknown">{t("case.smoking.unknown")}</option>
          <option value="never">{t("case.smoking.never")}</option>
          <option value="former">{t("case.smoking.former")}</option>
          <option value="current">{t("case.smoking.current")}</option>
        </select>
      </div>
      <div className={"case-meta-row" + (cigsDisabled ? " case-meta-row-disabled" : "")}>
        <label className="case-meta-row-label" htmlFor="caseMetaCigarettesPerDay">
          {t("case.cigarettesPerDay")}
        </label>
        <input
          id="caseMetaCigarettesPerDay"
          className="case-meta-input case-meta-input-narrow"
          type="number"
          min={0}
          max={99}
          disabled={readOnly || cigsDisabled}
          value={caseMeta.cigarettesPerDay ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setCigarettesPerDay(v === "" ? null : Number(v));
          }}
        />
      </div>
      <div className="case-meta-row">
        <label className="case-meta-row-label" htmlFor="caseMetaDiabetes">
          {t("case.diabetes.label")}
        </label>
        <select
          id="caseMetaDiabetes"
          className="odon-settings-select case-meta-select"
          disabled={readOnly}
          value={caseMeta.diabetesStatus}
          onChange={(e) => setDiabetesStatus(e.target.value)}
        >
          <option value="unknown">{t("case.diabetes.unknown")}</option>
          <option value="none">{t("case.diabetes.none")}</option>
          <option value="present">{t("case.diabetes.present")}</option>
        </select>
      </div>
      <div className={"case-meta-row" + (hba1cDisabled ? " case-meta-row-disabled" : "")}>
        <label className="case-meta-row-label" htmlFor="caseMetaHba1c">
          {t("case.hba1c")}
        </label>
        <input
          id="caseMetaHba1c"
          className="case-meta-input case-meta-input-narrow"
          type="number"
          min={3}
          max={20}
          step={0.1}
          disabled={readOnly || hba1cDisabled}
          value={caseMeta.hba1c ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setHba1c(v === "" ? null : Number(v));
          }}
        />
      </div>
      <div className="case-meta-row">
        <label className="case-meta-row-label" htmlFor="caseMetaRbl">
          {t("case.rbl")}
        </label>
        <input
          id="caseMetaRbl"
          className="case-meta-input case-meta-input-narrow"
          type="number"
          min={0}
          max={100}
          disabled={readOnly}
          value={caseMeta.maxRblPercent ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setMaxRblPercent(v === "" ? null : Number(v));
          }}
        />
      </div>
      <div className="case-meta-row">
        <label className="case-meta-row-label" htmlFor="caseMetaToothLoss">
          {t("case.toothLoss")}
        </label>
        <input
          id="caseMetaToothLoss"
          className="case-meta-input case-meta-input-narrow"
          type="number"
          min={0}
          max={32}
          disabled={readOnly}
          value={caseMeta.toothLossPerio ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setToothLossPerio(v === "" ? null : Number(v));
          }}
        />
      </div>
    </>
  );
}
