import React from "react";
import { openPerioOverlay } from "@/odontogram";
import { useOdontogramUi } from "@/OdontogramContext";

/**
 * Periodontal launch bar: view toggle (Odontogram vs Dental Chart) or
 * overlay open button, plus the Case Diagnoses modal trigger.
 */
export function PerioLaunchBar(): React.ReactElement {
  const {
    t,
    viewMode,
    activeView,
    setActiveView,
    perioChartAvailable,
    setCaseDxOpen,
  } = useOdontogramUi();

  return (
    <div className={"perio-launch-bar" + (perioChartAvailable ? "" : " hidden")}>
      {viewMode === "toggle" ? (
        <div id="appViewToggle" className="chart-mode-toggle" role="tablist">
          <button
            id="appViewOdontogram"
            type="button"
            className={"chart-mode-btn" + (activeView === "odontogram" ? " is-active" : "")}
            role="tab"
            aria-selected={activeView === "odontogram"}
            onClick={() => setActiveView("odontogram")}
          >
            {t("view.odontogram")}
          </button>
          <button
            id="appViewDentalChart"
            type="button"
            className={"chart-mode-btn" + (activeView === "dentalChart" ? " is-active" : "")}
            role="tab"
            aria-selected={activeView === "dentalChart"}
            onClick={() => setActiveView("dentalChart")}
          >
            {t("view.dentalChart")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          id="openPerioOverlayBtn"
          className="btn btn-ghost"
          onClick={() => openPerioOverlay()}
          title={t("perio.open")}
          aria-label={t("perio.open")}
        >
          {t("perio.open")}
        </button>
      )}
      <button
        type="button"
        id="openCaseDiagnosesBtn"
        className="btn btn-ghost"
        onClick={() => setCaseDxOpen(true)}
        title={t("case.diagnoses.section")}
        aria-label={t("case.diagnoses.section")}
      >
        {t("case.diagnoses.button")}
      </button>
    </div>
  );
}
