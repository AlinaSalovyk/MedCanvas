import React, { useEffect, useState } from "react";
import { t } from "@/i18n/useI18n";
import {
  getPerioSummary,
  getReadOnly,
  onStateChange,
  getCaseMeta,
  getPerioClassification,
} from "@/odontogram";
import {
  type PerioSummaryData,
  type CaseMetaData,
  type ClassificationData,
  EMPTY_SUMMARY,
  EMPTY_CASE_META,
  EMPTY_CLASSIFICATION,
} from "./types";
import { PerioSummaryCard } from "./PerioSummaryCard";
import { CaseMetaForm } from "./CaseMetaForm";
import { PerioClassificationPanel } from "./PerioClassificationPanel";

/**
 * Standalone perio-context panel bundling:
 * 1. The whole-mouth summary card (PerioSummaryCard).
 * 2. The patient-data case-metadata form (CaseMetaForm).
 * 3. The 2017 AAP/EFP classification block (PerioClassificationPanel).
 *
 * Renders into the right `<aside className="panel">` in the perio view.
 * Owns its own `summary`/`caseMeta`/`classification` React state and a single
 * `onStateChange` subscription.
 */
export function PerioSidebar(): React.ReactElement {
  const [summary, setSummary] = useState<PerioSummaryData>(EMPTY_SUMMARY);
  const [caseMeta, setCaseMetaState] = useState<CaseMetaData>(EMPTY_CASE_META);
  const [classification, setClassification] = useState<ClassificationData>(EMPTY_CLASSIFICATION);

  useEffect(() => {
    setSummary(getPerioSummary());
    setCaseMetaState(getCaseMeta());
    setClassification(getPerioClassification());
    const unsubscribe = onStateChange(() => {
      setSummary(getPerioSummary());
      setCaseMetaState(getCaseMeta());
      setClassification(getPerioClassification());
    });
    return unsubscribe;
  }, []);

  const readOnly = getReadOnly();

  return (
    <div className="panel-body">
      <PerioSummaryCard summary={summary} />

      <details id="caseMetaPanel" className="case-meta-panel" open>
        <summary className="case-meta-panel-title">{t("case.panelTitle")}</summary>
        <div className="case-meta-panel-body">
          <CaseMetaForm caseMeta={caseMeta} readOnly={readOnly} />
          <PerioClassificationPanel
            classification={classification}
            caseMeta={caseMeta}
            readOnly={readOnly}
          />
        </div>
      </details>
    </div>
  );
}

export default PerioSidebar;
