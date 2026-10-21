import React from "react";
import { t } from "@/i18n/useI18n";
import { formatToothLabel, getPerioIndexNameMode } from "@/odontogram";
import { indexName } from "@/perioIndexNames";
import { type PerioSummaryData, FURCATION_ROMAN } from "./types";

export interface PerioSummaryCardProps {
  summary: PerioSummaryData;
}

export function PerioSummaryCard({ summary }: PerioSummaryCardProps): React.ReactElement {
  const worstCalText =
    summary.worstCal === null
      ? "–"
      : `${summary.worstCal}${summary.worstCalTooth !== null ? ` (${formatToothLabel(summary.worstCalTooth)})` : ""}`;

  // Whole-mouth summary items that name a specific index (PD/CAL/BOP/Furcation/
  // Plaque) compose their label from the qualifier (Avg/Worst/Max/%) +
  // `indexName(...)`, so canonical mode swaps in the fixed English/Latin index
  // name instead of the localized `t(...)` string.
  const canonicalNames = getPerioIndexNameMode() === "canonical";
  const avgPdLabel = canonicalNames ? `Avg ${indexName("pd")}` : t("perio.summary.avgPd");
  const avgCalLabel = canonicalNames ? `Avg ${indexName("cal")}` : t("perio.summary.avgCal");
  const bopSummaryLabel = canonicalNames ? `${indexName("bop")}%` : t("perio.bopPercent");
  const worstCalLabel = canonicalNames ? `Worst ${indexName("cal")}` : t("perio.summary.worstCal");
  const maxPdLabel = canonicalNames ? `Max ${indexName("pd")}` : t("perio.summary.maxPd");
  const maxFurcationLabel = canonicalNames ? `Max ${indexName("furcation")}` : t("perio.summary.maxFurcation");
  const plaquePercentLabel = canonicalNames ? `${indexName("plaque")}%` : t("plaque.percent");

  return (
    <div className="perio-summary-card">
      <div className="perio-summary-card-title">{t("perio.summary.title")}</div>
      <div className="perio-fullgrid-summary" role="status">
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{avgPdLabel}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-avgpd">
            {summary.avgPd === null ? "–" : summary.avgPd}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{avgCalLabel}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-avgcal">
            {summary.avgCal === null ? "–" : summary.avgCal}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{bopSummaryLabel}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-bop">
            {summary.bopPercent}%
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{t("perio.summary.charted")}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-charted">
            {summary.chartedSites}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{worstCalLabel}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-cal">
            {worstCalText}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{maxPdLabel}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-maxpd">
            {summary.maxPd === null ? "–" : summary.maxPd}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{maxFurcationLabel}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-maxfurc">
            {summary.maxFurcation === null ? "–" : FURCATION_ROMAN[summary.maxFurcation]}
          </span>
        </span>
        <span className="perio-fullgrid-summary-item">
          <span className="perio-fullgrid-summary-label">{plaquePercentLabel}</span>
          <span className="perio-fullgrid-summary-value" id="perio-fg-summary-plaque">
            {summary.plaquePercent}%
          </span>
        </span>
      </div>
    </div>
  );
}
