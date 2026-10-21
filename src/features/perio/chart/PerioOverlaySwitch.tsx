import { t } from "@/i18n/useI18n";
import { getPerioIndexNameMode, type PerioOverlayLayer } from "@/odontogram";
import { CANONICAL_INDEX_NAMES } from "@/perioIndexNames";
import { SWITCHER_LAYERS, OVERLAY_LAYER_TO_ROW } from "./constants";
import type { PerioSummaryData } from "./types";

export function overlaySwitchLabel(layer: PerioOverlayLayer): string {
  const rowId = OVERLAY_LAYER_TO_ROW[layer];
  if (rowId && getPerioIndexNameMode() === "canonical") return CANONICAL_INDEX_NAMES[rowId];
  return t(`perio.overlay.${layer}`);
}

export function PerioOverlaySwitch({
  overlayLayer,
  onSelectLayer,
  summary,
}: {
  overlayLayer: PerioOverlayLayer;
  onSelectLayer: (layer: PerioOverlayLayer) => void;
  summary: PerioSummaryData;
}) {
  const overlayReadout =
    overlayLayer === "bop"
      ? `${t("perio.bopPercent")} ${summary.bopPercent}%`
      : overlayLayer === "plaque"
      ? `${t("plaque.percent")} ${summary.plaquePercent}%`
      : overlayLayer === "pi"
      ? `${t("perio.overlay.pi")} ${summary.piScore ?? "—"}`
      : overlayLayer === "gi"
      ? `${t("perio.overlay.gi")} ${summary.giScore ?? "—"}`
      : overlayLayer === "kg"
      ? `${t("perio.overlay.kg")} ${summary.kgDeficientTeeth}`
      : overlayLayer === "mpi"
      ? `${t("perio.overlay.mpi")} ${summary.mpiScore ?? "—"}`
      : overlayLayer === "mbi"
      ? `${t("perio.overlay.mbi")} ${summary.mbiScore ?? "—"}`
      : null;

  return (
    <div id="perioOverlaySwitch" className="perio-overlay-switch" role="radiogroup" aria-label={t("perio.overlay.label")}>
      {SWITCHER_LAYERS.map((layer) => (
        <button
          key={layer}
          type="button"
          role="radio"
          aria-checked={overlayLayer === layer}
          className={"perio-overlay-switch-btn" + (overlayLayer === layer ? " is-active" : "")}
          data-overlay-layer={layer}
          onClick={() => onSelectLayer(layer)}
        >
          {overlaySwitchLabel(layer)}
        </button>
      ))}
      {overlayReadout && (
        <span className="perio-overlay-readout" id="perioOverlayReadout">
          {overlayReadout}
        </span>
      )}
    </div>
  );
}
