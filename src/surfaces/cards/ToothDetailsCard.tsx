// Composable-UI Tier 3, PR 3f — the declarative Tooth-details card BODY (the
// HARDEST card). Replaces the former imperative `wireControls()` Tooth-details
// block + its (largest) `syncControlsFromState()` counterpart: it subscribes to
// engine state (`useEngineState(getActiveToothDetails)`) and renders ALL rows as
// controlled inputs with identical ids/markup —
//
//   the base picker (#toothSelect, options folding the MILKTOOTH_BLOCKED disable),
//   the substrate select (#substrateSelect), the extraction-wound / missing-closed
//   checkboxes, the combined restoration dropdown (#restorationSelect, whose
//   per-tooth options are already encoded `${type}|${material}` / `prosthesis|…`
//   by the getter and decoded+applied by `setRestorationForSelection`), the
//   crown-leakage / broken-crown / contact-point checkboxes, the wear block
//   (#bruxismRow → #wearEdgeRow/#wearCervicalRow) with the detail-level
//   select-vs-toggle swap, the discoloration row with the same swap, the crown
//   actions (#crownActionsRow: #bridgePillarRow + #extractionPlanRow) and the
//   crown-replace / crown-needed checkboxes.
//
// writing through the `set*ForSelection` setters — which wrap the exact
// `applyToSelected(...)` closures the imperative handlers used (incl. the
// base-picker `defaultState()` reset + `setEdentulous(false)` side-effects and
// the restoration `${type}|${material}` decode), so behavior is identical.
//
// Row visibility + label variants + the wear/discoloration select-vs-toggle swap
// come pre-resolved from `getActiveToothDetails()`. The genuine DOM-reparenting
// quirk — the imperative code moves #extractionPlanRow among #brokenCrownRow /
// #bruxismRow / #crownActionsRow depending on state — is resolved by the getter
// to a single `extractionPlanParent` id; the card renders exactly ONE instance of
// #extractionPlanRow, inside that parent (default state → #crownActionsRow, so the
// shell-DOM golden stays byte-identical).
//
// The `.card` wrapper, `.card-title`, and the `#btnResetTooth` action button stay
// STATIC in `ToothControlsSurface` (its onClick calls `resetTooth()`); this card
// only owns the body.

import { t } from "../../i18n/useI18n";
import {
  getActiveToothDetails,
  setToothSelectionForSelection,
  setSubstrateForSelection,
  setRestorationForSelection,
  setExtractionWoundForSelection,
  setExtractionPlanForSelection,
  setMissingClosedForSelection,
  setCrownLeakageForSelection,
  setBrokenMesialForSelection,
  setBrokenIncisalForSelection,
  setBrokenDistalForSelection,
  setContactMesialForSelection,
  setContactDistalForSelection,
  setWearEdgeForSelection,
  setWearCervicalForSelection,
  setWearEdgeToggleForSelection,
  setWearCervicalToggleForSelection,
  setDiscolorationForSelection,
  setDiscolorationToggleForSelection,
  setBridgePillarForSelection,
  setCrownReplaceForSelection,
  setCrownNeededForSelection,
} from "../../odontogram";
import { useEngineState } from "../useEngineState";

const PROSTHESIS_SUMMARY_KEY: Record<string, string> = {
  "healing-abutment": "prosthesis.healingAbutment",
  locator: "prosthesis.locator",
  "locator-denture": "prosthesis.locatorDenture",
  bar: "prosthesis.bar",
  "bar-denture": "prosthesis.barDenture",
  "removable-partial": "prosthesis.removablePartial",
  "removable-full": "prosthesis.removableFull",
};

function toothSelectLabel(o: { value: string; label: string }): string {
  const map: Record<string, string> = {
    "tooth-base": "toothSelect.permanent",
    none: "toothSelect.none",
    milktooth: "toothSelect.milk",
    implant: "toothSelect.implant",
    "tooth-under-gum": "toothSelect.underGum",
    "no-tooth-after-extraction": "toothSelect.none",
  };
  return map[o.value] ? t(map[o.value]) : o.label;
}

function substrateLabel(o: { value: string; label: string }): string {
  const map: Record<string, string> = {
    natural: "substrate.natural",
    radix: "substrate.radix",
    broken: "substrate.broken",
    crownprep: "substrate.crownprep",
  };
  return map[o.value] ? t(map[o.value]) : o.label;
}

function restorationLabel(o: { value: string; label: string }): string {
  if (o.value === "none|none" || o.value === "none") {
    return t("restoration.none");
  }
  if (o.value.startsWith("prosthesis|")) {
    const pVal = o.value.slice("prosthesis|".length);
    const summaryKey = PROSTHESIS_SUMMARY_KEY[pVal] ?? pVal;
    return `${t("restoration.prefix.removable")}: ${t(summaryKey)}`;
  }
  const [type, material] = o.value.split("|");
  if (type && material) {
    const matKey = material === "metal-ceramic" ? "metalCeramic" : material;
    return `${t("restoration.prefix.fixed")}: ${t(`restoration.type.${type}`)} \u2013 ${t(`restoration.material.${matKey}`)}`;
  }
  return o.label;
}

function wearOptionLabel(o: { value: string; label: string }): string {
  const key = "wearType." + o.value;
  const translated = t(key);
  return translated !== key ? translated : o.label;
}

function discolorationOptionLabel(o: { value: string; label: string }): string {
  const key = "discoloration." + o.value;
  const translated = t(key);
  return translated !== key ? translated : o.label;
}

export default function ToothDetailsCard() {
  const td = useEngineState(getActiveToothDetails);

  // The single #extractionPlanRow instance \u2014 rendered inside whichever parent the
  // getter resolved (mirrors the imperative appendChild reparent). Only ONE branch
  // below is true per render, so exactly one instance mounts.
  const extractionPlanRow = (
    <label id="extractionPlanRow" className={td.extractionPlanRowVisible ? "inline-check" : "inline-check hidden"}>
      <input
        type="checkbox"
        id="extractionPlan"
        checked={td.extractionPlanChecked}
        onChange={(e) => setExtractionPlanForSelection(e.target.checked)}
      />
      <span>{t("tooth.extractionPlan")}</span>
    </label>
  );

  return (
    <>
      <div className="row">
        <span>{t("tooth.baseLabel")}</span>
        <select
          id="toothSelect"
          value={td.toothSelectValue}
          onChange={(e) => setToothSelectionForSelection(e.target.value)}
        >
          {td.toothSelectOptions.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{toothSelectLabel(o)}</option>
          ))}
        </select>
      </div>
      <div id="substrateRow" className={td.substrateRowVisible ? "row" : "row hidden"}>
        <span>{t("substrate.label")}</span>
        <select
          id="substrateSelect"
          value={td.substrateValue}
          onChange={(e) => setSubstrateForSelection(e.target.value)}
        >
          {td.substrateOptions.map((o) => (
            <option key={o.value} value={o.value}>{substrateLabel(o)}</option>
          ))}
        </select>
      </div>
      <label id="extractionRow" className={td.extractionRowVisible ? "row" : "row hidden"}>
        <input
          type="checkbox"
          id="extractionWound"
          checked={td.extractionWoundChecked}
          onChange={(e) => setExtractionWoundForSelection(e.target.checked)}
        />
        <span>{t("tooth.extractionWound")}</span>
      </label>
      <label id="missingClosedRow" className={td.missingClosedRowVisible ? "row" : "row hidden"}>
        <input
          type="checkbox"
          id="missingClosed"
          checked={td.missingClosedChecked}
          onChange={(e) => setMissingClosedForSelection(e.target.checked)}
        />
        <span>{t("tooth.missingClosed")}</span>
      </label>
      <div id="restorationRow" className={td.restorationRowVisible ? "row" : "row hidden"}>
        <span>{t("restoration.label")}</span>
        <select
          id="restorationSelect"
          value={td.restorationValue}
          onChange={(e) => setRestorationForSelection(e.target.value)}
        >
          {td.restorationOptions.map((o) => (
            <option key={o.value} value={o.value}>{restorationLabel(o)}</option>
          ))}
        </select>
      </div>
      <label id="crownLeakageRow" className={td.crownLeakageRowVisible ? "row" : "row hidden"}>
        <input
          type="checkbox"
          id="crownLeakage"
          checked={td.crownLeakageChecked}
          onChange={(e) => setCrownLeakageForSelection(e.target.checked)}
        />
        <span>{t("crownLeakage.label")}</span>
      </label>
      <div id="brokenCrownRow" className={td.brokenCrownRowVisible ? "row inline-checks contact-row" : "row inline-checks contact-row hidden"}>
        <label>
          <input
            type="checkbox"
            id="brokenMesial"
            checked={td.brokenMesialChecked}
            onChange={(e) => setBrokenMesialForSelection(e.target.checked)}
          />
          <span>{t("tooth.broken.mesial")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            id="brokenIncisal"
            checked={td.brokenIncisalChecked}
            onChange={(e) => setBrokenIncisalForSelection(e.target.checked)}
          />
          <span>{t("tooth.broken.incisal")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            id="brokenDistal"
            checked={td.brokenDistalChecked}
            onChange={(e) => setBrokenDistalForSelection(e.target.checked)}
          />
          <span>{t("tooth.broken.distal")}</span>
        </label>
        {td.extractionPlanParent === "brokenCrownRow" && extractionPlanRow}
      </div>
      <div id="contactPointRow" className={td.contactPointRowVisible ? "row inline-checks contact-row" : "row inline-checks contact-row hidden"}>
        <label>
          <input
            type="checkbox"
            id="contactMesial"
            checked={td.contactMesialChecked}
            onChange={(e) => setContactMesialForSelection(e.target.checked)}
          />
          <span>{t("tooth.contact.mesialMissing")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            id="contactDistal"
            checked={td.contactDistalChecked}
            onChange={(e) => setContactDistalForSelection(e.target.checked)}
          />
          <span>{t("tooth.contact.distalMissing")}</span>
        </label>
      </div>
      <div id="bruxismRow" className={td.bruxismRowVisible ? "inline-checks bruxism-row wear-stack" : "inline-checks bruxism-row wear-stack hidden"}>
        <div id="wearEdgeRow" className="row">
          <label id="wearEdgeSelectLabel" className={td.wearSimple ? "hidden" : undefined}>
            <span>{t("tooth.bruxism.edgeWear")}</span>
            <select
              id="wearEdgeSelect"
              value={td.wearEdgeValue}
              onChange={(e) => setWearEdgeForSelection(e.target.value)}
            >
              {td.wearEdgeOptions.map((o) => (
                <option key={o.value} value={o.value}>{wearOptionLabel(o)}</option>
              ))}
            </select>
          </label>
          <label id="wearEdgeToggleLabel" className={td.wearSimple ? "inline-check" : "inline-check hidden"}>
            <input
              type="checkbox"
              id="wearEdgeToggle"
              checked={td.wearEdgeToggleChecked}
              onChange={(e) => setWearEdgeToggleForSelection(e.target.checked)}
            />
            <span>{t("tooth.bruxism.edgeWear")}</span>
          </label>
        </div>
        <div id="wearCervicalRow" className="row">
          <label id="wearCervicalSelectLabel" className={td.wearSimple ? "hidden" : undefined}>
            <span>{t("tooth.bruxism.neckWear")}</span>
            <select
              id="wearCervicalSelect"
              value={td.wearCervicalValue}
              onChange={(e) => setWearCervicalForSelection(e.target.value)}
            >
              {td.wearCervicalOptions.map((o) => (
                <option key={o.value} value={o.value}>{wearOptionLabel(o)}</option>
              ))}
            </select>
          </label>
          <label id="wearCervicalToggleLabel" className={td.wearSimple ? "inline-check" : "inline-check hidden"}>
            <input
              type="checkbox"
              id="wearCervicalToggle"
              checked={td.wearCervicalToggleChecked}
              onChange={(e) => setWearCervicalToggleForSelection(e.target.checked)}
            />
            <span>{t("tooth.bruxism.neckWear")}</span>
          </label>
        </div>
        {td.extractionPlanParent === "bruxismRow" && extractionPlanRow}
      </div>
      <div id="discolorationRow" className={td.discolorationRowVisible ? "row inline-checks" : "row inline-checks hidden"}>
        <label id="discolorationSelectLabel" className={td.discoSimple ? "hidden" : undefined}>
          <span>{t("discoloration.label")}</span>
          <select
            id="discolorationSelect"
            value={td.discolorationValue}
            onChange={(e) => setDiscolorationForSelection(e.target.value)}
          >
            {td.discolorationOptions.map((o) => (
              <option key={o.value} value={o.value}>{discolorationOptionLabel(o)}</option>
            ))}
          </select>
        </label>
        <label id="discolorationToggleLabel" className={td.discoSimple ? "inline-check" : "inline-check hidden"}>
          <input
            type="checkbox"
            id="discolorationToggle"
            checked={td.discolorationToggleChecked}
            onChange={(e) => setDiscolorationToggleForSelection(e.target.checked)}
          />
          <span>{t("discoloration.label")}</span>
        </label>
      </div>
      <div id="crownActionsRow" className={td.crownActionsRowVisible ? "row inline-checks bridge-actions-row" : "row inline-checks bridge-actions-row hidden"}>
        <label id="bridgePillarRow" className={td.bridgePillarRowVisible ? "inline-check" : "inline-check hidden"}>
          <input
            type="checkbox"
            id="bridgePillar"
            checked={td.bridgePillarChecked}
            onChange={(e) => setBridgePillarForSelection(e.target.checked)}
          />
          <span>{t("tooth.bridgePillar")}</span>
        </label>
        {td.extractionPlanParent === "crownActionsRow" && extractionPlanRow}
      </div>
      <label id="crownReplaceRow" className={td.crownReplaceRowVisible ? "row" : "row hidden"}>
        <input
          type="checkbox"
          id="crownReplace"
          checked={td.crownReplaceChecked}
          onChange={(e) => setCrownReplaceForSelection(e.target.checked)}
        />
        <span>{t("tooth.crownReplace")}</span>
      </label>
      <label id="crownNeededRow" className={td.crownNeededRowVisible ? "row" : "row hidden"}>
        <input
          type="checkbox"
          id="crownNeeded"
          checked={td.crownNeededChecked}
          onChange={(e) => setCrownNeededForSelection(e.target.checked)}
        />
        <span>{t("tooth.crownNeeded")}</span>
      </label>
    </>
  );
}
