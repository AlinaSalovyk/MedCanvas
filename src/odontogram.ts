import { t, onI18nChange } from "@/i18n/useI18n";
import { toLabel, type NumberingSystem } from "@/utils/numbering";
import { type OdontogramPlugin } from "@/plugin";
import {
  applyPluginOverlays as applyPluginOverlaysRenderer,
  type PluginOverlayRegistry,
} from "@/engine/overlays/pluginOverlayRenderer";
import { parseFhirBundle } from "@/fhir/fromFhir";
import { optionsFor } from "@/registry/uiOptions";
import {
  applyStateToSvgSingle,
  applyProposedStyling,
  collectActiveLayers,
} from "@/engine/rendering/toothSvgPainter";
import {
  updateBridgeOverlay,
  setupBridgeOverlayResize,
  teardownBridgeOverlayResize,
} from "@/engine/overlays/bridgeOverlayManager";
import { resetTemplateCache as resetPerioTemplateCache } from "@/perioGraphic";
import { TEMPLATES, TOOTH_TEMPLATE, ALL_TEETH, activeAnatomyProfile, applyToothAnatomy, getToothAnatomy, ensureMeasuredProfile, type ToothAnatomy, type AnatomyProfile } from "@/anatomy/profiles";
export { isUpperTooth } from "@/anatomy/profiles";
export { getToothAnatomy, activeAnatomyProfile } from "@/anatomy/profiles";
import { notifyStateChange, setPostNotifyHook, onStateChange } from "@/state/notify";
import { resetCaseMeta } from "@/state/caseMeta";
import { charts, toothState, chartMode, planInitialized, setActiveChartMode, setPlanInitialized, cloneChart, type ChartMode } from "@/state/chart";
export { formatToothLabel } from "@/state/numbering";
import { numberingSystem, applyNumberingSystem, getDisplayedToothNumber } from "@/state/numbering";
export type { PerioSite } from "@/state/payload";
export { isPerioRowHidden, isToothImplant, getPerioToothKind, getToothMobility } from "@/state/perio";
export {
  getScreenToothSpacing, setScreenToothSpacing, getScreenToothNumberSize, setScreenToothNumberSize,
  getSelectionColor, setSelectionColor, getSelectionBorderStyle, setSelectionBorderStyle,
  getToothInfoVisible, setToothInfoVisible,
} from "@/state/displaySettings";
export type { ScreenToothSpacing, ScreenToothNumberSize, SelectionBorderStyle } from "@/state/displaySettings";

export { getPerioIndexNameMode, getPerioRowVisibility, setPerioIndexNameMode, setPerioRowVisibility } from "@/state/perioSettings";
export type { PerioIndexNameMode, PerioRowId } from "@/state/perioSettings";

export {
  PULP_LATIN_PARENT, __discolorationAllowedForTest, __discolorationRowAllowedForTest, __orthoAllowedForTest, __orthoCardAllowedForTest, __wearRowAllowedForTest, buildPulpEndoSelect, getOrthoApplianceOptions, getOrthoDriftOptions, getOrthoVerticalOptions, getPulpDetailLevel, isEndoValue, periapicalRowVisible, pulpDisplayValue, pulpEndoDisplayValue, pulpEndoOnSelect, pulpSelectOptionValues, pulpSelectionToState,
} from "@/state/pulpApical";
export type { PulpDetailLevel } from "@/state/pulpApical";
import { PulpDetailLevel, applyPulpDetailLevel } from "@/state/pulpApical";

export {
  buildDerivationInputFromState, getCejVisibility, getGingivalIndex, getGingivalThickness, getKeratinizedWidth, getMillerClass, getPeriImplantBleeding, getPeriImplantPlaque, getPerioChart, getPerioClassification, getPerioSummary, getPlaqueIndex, getRootConcavity, getToothCal, getToothFurcation, getToothPerio, getToothPlaque, getToothRecessionType, hasAnyPerioData, setCejVisibility, setFurcation, setGingivalIndex, setGingivalThickness, setKeratinizedWidth, setMillerClass, setPeriImplantBleeding, setPeriImplantPlaque, setPerioSite, setPlaque, setPlaqueIndex, setRootConcavity,
} from "@/state/perio";
export type { PerioClassificationResult, RecessionType } from "@/state/perio";
export { getChartMode } from "@/state/chart";
export type { ChartMode };

export {
  PERIO_SITES, TOOTH_LEVEL_DX_KEYS, VALID_APICAL_DX, VALID_CARIES, VALID_CARIES_SEVERITY, VALID_CARS, VALID_CEJ_VISIBILITY, VALID_DISCOLORATION, VALID_DX_OVERRIDE_VALUE, VALID_ENDO, VALID_FILLING_DEFECT, VALID_FILLING_DEFECT_SET, VALID_FILLING_MATERIAL, VALID_FILLING_SURFACES, VALID_FURCATION_ENTRANCE, VALID_FURCATION_GRADE, VALID_GINGIVAL_THICKNESS, VALID_MILLER_CLASS, VALID_MOBILITY, VALID_MODS, VALID_ORTHO_APPLIANCE, VALID_ORTHO_DRIFT, VALID_ORTHO_VERTICAL, VALID_PERIAPICAL_TYPE, VALID_PERI_IMPLANT, VALID_PLAQUE_SURFACE, VALID_PROSTHESIS, VALID_PULP_DX, VALID_PULP_LATIN, VALID_RADIOGRAPHIC_DEPTH, VALID_RESORPTION_TYPE, VALID_RESTORATION_MATERIAL, VALID_RESTORATION_TYPE, VALID_ROOT_CARIES, VALID_ROOT_CONCAVITY, VALID_TOOTH_SELECTION, VALID_TOOTH_SUBSTRATE, VALID_WEAR_CERVICAL, VALID_WEAR_EDGE, furcationEntrances, threeLevelToIcdas,
} from "@/state/payload";
import { defaultState, hydrateState, isLegacyPayloadVersion, serializeState, setPluginIdsProvider, perioRowHidden, VALID_MOBILITY } from "@/state/payload";

export { TEMPLATES, TOOTH_TEMPLATE };
export { CLASSIC_CEJ_Y, CLASSIC_IMPLANT_CEJ_Y, CLASSIC_MILKTOOTH_CEJ_Y } from "@/anatomy/profiles";
export type { ToothAnatomy, AnatomyProfile };
export type { CaseMeta } from "@/state/caseMeta";
export type { PlainPerio, PerioSitePatch } from "@/state/perio";
export type { FinalPerioClassification } from "@/fhir/toFhirPerio";

let anatomyRequest = 0;
let anatomyTarget: ToothAnatomy | null = null;

export async function setToothAnatomy(v: ToothAnatomy): Promise<void> {
  if(v === (anatomyTarget ?? getToothAnatomy())) return;
  const token = ++anatomyRequest;
  anatomyTarget = v;
  if(v === "measured"){
    try {
      await ensureMeasuredProfile();
    } catch(err) {
      if(token === anatomyRequest) anatomyTarget = null;
      console.error("odontogram: the measured tooth anatomy could not be loaded — staying on the current profile", err);
      return;
    }
  }
  if(token !== anatomyRequest) return;
  anatomyTarget = null;
  if(!applyToothAnatomy(v)) return;
  resetPerioTemplateCache();
  try {
    await rebuildGrid();
  } finally {
    notifyStateChange();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export type * from "@/engine/types";

import {
  icdasTier,
  icdasToThreeLevel,
  getCariesDepthOptions,
  secondaryCariesOptions,
  radiographicDepthOptions,
  applyRecurrentCariesScore,
  applyRadiographicDepth,
  applyFillingDefect,
} from "@/engine/cariesMutations";

import {
  getStatusExtras,
  getStatusExtrasMeta,
} from "@/engine/clinicalOptions";

import {
  calculateStatusPresetChanges,
  calculatePrimaryDentitionTarget,
  calculateMixedDentitionTarget,
} from "@/engine/presets/clinicalPresetCalculators";

import {
  wisdomVisible,
  showBase,
  occlusalVisible,
  showHealthyPulp,
  edentulous,
  suppressEdentulousSync,
  readOnly,
  setWisdomVisibleState,
  setShowBaseState,
  setOcclusalVisibleState,
  setHealthyPulpVisibleState,
  setEdentulousState,
  setSuppressEdentulousSyncState,
  setReadOnlyState,
} from "@/engine/displayGlobals";

import {
  $,
  $$,
  el,
  stripDisplayNoneToDataActive,
  ensureDataActiveForSwitchables,
  rotate180,
  mirrorVertical,
} from "@/engine/domHelpers";

import {
  loadInlineIcon,
  syncIconXLine,
  setToggleButton,
  applyToggleA11y,
} from "@/engine/controls/controlPresentation";

import {
  buildPerioGrid,
  syncPerioRow,
} from "@/engine/controls/perioGridController";

import {
  setRevertControlsHandler,
  mirrorStatusToPlan,
  gateToothEdit,
  gateToothEditBatch,
  clearPendingDualStateConfirm,
  clearPlanEditedTeeth,
} from "@/engine/dualStateGate";

import {
  setPlanRepaintHook,
  hydrateImportedCharts,
  resetActiveChartToStatusAfterImport,
  exportStatus,
  exportFhir,
} from "@/engine/exportPayload";

import {
  exportSvg,
  exportImage,
  exportPerioSvg,
  exportPerioImage,
} from "@/engine/exportRasterPdf";

import {
  setExportViewToggleHandlers,
} from "@/engine/exportSvg";

import {
  activeTooth,
  selectedTeeth,
  setApplyToSelectedHandler,
  setClearSelectionHandler,
  setActiveTooth,
  setSelectedTeeth,
  clearSelection,
} from "@/engine/selection";

import {
  setSessionControlsSyncHook,
  setSessionTooltipSyncHook,
  collapsedCards,
  setCollapsedCards,
  getWearDetailLevel,
  getDiscolorationDetailLevel,
  notesEnabled,
  setNotesEnabledRaw,
} from "@/engine/sessionSettings";

import {
  getStateSummary,
} from "@/engine/summary";

import {
  surfaceLabelKey,
} from "@/engine/surfaceHelpers";

import {
  showCariesDepthPopup,
  showFillingDefectPopup,
} from "@/engine/popups/surfacePopups";

import {
  showZoomPopover as showZoomPopoverOverlay,
  hideZoomPopover,
  showContextMenu as showContextMenuOverlay,
  hideContextMenu,
  showNoteEditor as showNoteEditorOverlay,
  hideNoteEditor,
} from "@/engine/overlays/tileOverlays";

import {
  isTouchDevice,
  onGridTouchStart,
  onGridTouchMove,
  onGridTouchEnd,
  buildArchToggle,
  refreshArchToggleLabels,
  addTouchToTile,
  destroyTouchGestures,
} from "@/engine/gestures/touchGestures";

import {
  onToothKeydown as onToothKeydownNav,
} from "@/engine/navigation/tileNavigation";

import {
  bindSelectionControls,
  updateActiveLabel,
  updateSelectionFilterButtons,
} from "@/engine/controls/selectionControls";

import {
  bindChartTransferControls,
  setImportFormat,
} from "@/engine/controls/chartTransferControls";

import {
  getStateWarnings,
} from "@/engine/warnings";

import {
  setEdentulousResetter,
  setResetToothHandler,
} from "@/engine/cards/toothDetailsCardApi";

export {
  rootCariesOptions,
  rootCariesDisplayValue,
  applySecondaryCariesScore,
} from "@/engine/cariesMutations";

export {
  __restorationRowHiddenForTest,
  __applyRestorationSelectionForTest,
  __mobilityRowHiddenForTest,
  __mobilityDisabledForTest,
  __applyPeriImplantSelectionForTest,
} from "@/engine/clinicalOptions";

export {
  isAnteriorTooth,
} from "@/engine/constants";

export {
  getToothDiagnoses,
} from "@/engine/diagnoses";

export {
  getEdentulous,
  getReadOnly,
  __setShowHealthyPulpForTest,
} from "@/engine/displayGlobals";

export {
  isDualStateConfirmPending,
  acceptDualStateConfirm,
  cancelDualStateConfirm,
  __planEditedTeethForTest,
} from "@/engine/dualStateGate";

export {
  getPlanChanges,
  compareExams,
} from "@/engine/examCompare";

export {
  __collectExportPayloadForTest,
  getStatusChart,
  getPlanChart,
  setPlanChart,
  __hydrateImportedChartsForTest,
  __importStatusForTest,
} from "@/engine/exportPayload";

export {
  __buildPerioAbbreviationsForTest,
  exportPdf,
} from "@/engine/exportRasterPdf";

export {
  pruneHiddenClone,
  namespaceIds,
  buildOdontogramSvg,
} from "@/engine/exportSvg";

export {
  subcariesLettersForTooth,
  computeFillingSubcariesSummaryLine,
  fillingDefectLettersForTooth,
  computeFillingDefectSummaryLine,
} from "@/engine/fillingSummary";

export {
  getPdfSettings,
  setPdfSettings,
  __pdfPatientRowsForTest,
} from "@/engine/pdfSettings";

export {
  nextPerioCell,
  prevPerioCell,
} from "@/engine/perioNav";

export {
  getSelectedTeeth,
  __setActiveToothForTest,
  __setSelectionForTest,
} from "@/engine/selection";

export {
  getCollapsedCards,
  isCardCollapsed,
  setCollapsedCard,
  toggleCollapsedCard,
  setIcdasEnabled,
  getIcdasEnabled,
  setWearDetailLevel,
  setDiscolorationDetailLevel,
  setSurfaceNotation,
  getSurfaceNotation,
  setSecondaryCariesMode,
  getSecondaryCariesMode,
  setRootCariesMode,
  getRootCariesMode,
  setRadiographicDepthMode,
  getRadiographicDepthMode,
  setCariesDepthEnabled,
  getCariesDepthEnabled,
  getFillingDefectEnabled,
  setFillingDefectEnabled,
  getFillingComplexity,
  setFillingComplexity,
  getFissureSealingEnabled,
  setFissureSealingEnabled,
  getFillingMaterialAvailability,
  setFillingMaterialAvailability,
  getPerioViewMode,
  setPerioViewMode,
  getDiagnosisCodingPack,
  setDiagnosisCodingPack,
  getSnomedEnabled,
  setSnomedEnabled,
  getPerioOverlayLayer,
  setPerioOverlayLayer,
  getNotesEnabled,
} from "@/engine/sessionSettings";

export {
  getToothStateSummary,
  getOdontogramSummary,
} from "@/engine/summary";

export {
  surfaceLetter,
  buildSurfaceCross,
} from "@/engine/surfaceHelpers";

export {
  __getStateWarnings,
} from "@/engine/warnings";

export {
  getActiveCaries,
  setCariesSurfaceForSelection,
  setCariesActiveDepthForSelection,
  setRootCariesForSelection,
} from "@/engine/cards/cariesCardApi";

export {
  REVERSE_MAPPABLE_KEYS,
  getActiveDiagnoses,
  addDiagnosisToSelection,
  removeDiagnosisFromSelection,
  setDxOverrideForSelection,
} from "@/engine/cards/diagnosesCardApi";

export {
  getActiveFillings,
  setFillingMaterialForSelection,
  setFillingSurfaceForSelection,
  setFillingSimpleToggleForSelection,
  setFillingSimpleDefectForSelection,
  setFissureSealingForSelection,
} from "@/engine/cards/fillingsCardApi";

export {
  getActiveOrtho,
  setOrthoApplianceForSelection,
  setOrthoDriftForSelection,
  setOrthoVerticalForSelection,
  setOrthoRotationForSelection,
} from "@/engine/cards/orthoCardApi";

export {
  getActiveRootPerio,
  setPulpEndoForSelection,
  setApicalDxForSelection,
  setPeriapicalTypeForSelection,
  setResorptionForSelection,
  setEndoResectionForSelection,
  setParapulpalPinForSelection,
  setMobilityForSelection,
  setModForSelection,
  setCalculusForSelection,
  setPeriImplantForSelection,
} from "@/engine/cards/rootPerioCardApi";

export {
  getActiveToothDetails,
  setToothSelectionForSelection,
  setSubstrateForSelection,
  setRestorationForSelection,
  setExtractionWoundForSelection,
  setExtractionPlanForSelection,
  setCrownReplaceForSelection,
  setCrownNeededForSelection,
  setCrownLeakageForSelection,
  setMissingClosedForSelection,
  setContactMesialForSelection,
  setContactDistalForSelection,
  setBridgePillarForSelection,
  setBrokenMesialForSelection,
  setBrokenIncisalForSelection,
  setBrokenDistalForSelection,
  setWearEdgeForSelection,
  setWearCervicalForSelection,
  setDiscolorationForSelection,
  setWearEdgeToggleForSelection,
  setWearCervicalToggleForSelection,
  setDiscolorationToggleForSelection,
  resetTooth,
} from "@/engine/cards/toothDetailsCardApi";

export {
  icdasTier,
  icdasToThreeLevel,
  getCariesDepthOptions,
  secondaryCariesOptions,
  radiographicDepthOptions,
  applyRecurrentCariesScore,
  applyRadiographicDepth,
  applyFillingDefect,
  getStatusExtras,
  exportStatus,
  exportFhir,
  exportSvg,
  exportImage,
  exportPerioSvg,
  exportPerioImage,
  clearSelection,
  getWearDetailLevel,
  getDiscolorationDetailLevel,
  surfaceLabelKey,
};

const MOD_OPTIONS = optionsFor("mods");
// ---- Dual-state core ----
// toothState is a live alias to whichever chart (Status or Plan) is currently active.

// ---- Case-level metadata object (extracted to ./state/caseMeta) ----
export {
  getCaseConditions, getCaseMeta, resetCaseMeta, setCaseAge, setCaseCondition, setCigarettesPerDay, setDiabetesStatus, setDiagnosisOverride, setExamDate, setExtentOverride, setGradeOverride, setHba1c, setMaxRblPercent, setPatientDob, setPatientName, setSmokingStatus, setStageOverride, setToothLossPerio,
} from "./state/caseMeta";



function revertActiveControls(): void {
  if(activeTooth != null) syncControlsFromState(toothState.get(activeTooth));
}

/** Sync the Status/Plan toggle and chart container styling with current chartMode. */
function syncChartModeUi(): void {
  const isPlan = chartMode === "plan";
  const statusBtn = $("#chartModeStatus") as HTMLElement | null;
  const planBtn = $("#chartModePlan") as HTMLElement | null;
  const chartCard = $(".chart") as HTMLElement | null;
  const badge = $("#chartModePlanBadge") as HTMLElement | null;
  if(statusBtn){
    statusBtn.classList.toggle("is-active", !isPlan);
    statusBtn.setAttribute("aria-selected", String(!isPlan));
  }
  if(planBtn){
    planBtn.classList.toggle("is-active", isPlan);
    planBtn.setAttribute("aria-selected", String(isPlan));
  }
  if(chartCard) chartCard.classList.toggle("plan-mode", isPlan);
  if(badge) badge.classList.toggle("hidden", !isPlan);
}

/**
 * Switch the active chart between "status" and "plan".
 * Lazily clones the plan on first switch and repaints the grid.
 *
 * @param mode - Target chart mode ("status" | "plan").
 */
export function setChartMode(mode: ChartMode): void {
  if(mode !== "status" && mode !== "plan") return;
  if(mode === chartMode) return;
  if(mode === "plan" && !planInitialized){
    cloneChart(charts.status, charts.plan);
    setPlanInitialized(true);
    clearPlanEditedTeeth();
  }
  setActiveChartMode(mode);
  for(const toothNo of ALL_TEETH){
    applyStateToSvg(toothNo);
    updateToothTileNumber(toothNo);
    updateToothLabelNoteIcon(toothNo);
  }
  if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
  notifyStateChange();
  syncChartModeUi();
}

const toothSvgRoot = new Map(); // toothNo -> [svg elements]
const toothTile = new Map(); // toothNo -> [tile elements]
const toothLabelUpper = new Map(); // toothNo -> label element
const toothLabelLower = new Map(); // toothNo -> label element

/** Set the session pulp diagnosis detail level (simple, AAE, or practical Latin). */
export function setPulpDetailLevel(value: PulpDetailLevel){
  if(!applyPulpDetailLevel(value)) return;
  if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
  notifyStateChange();
  for(const toothNo of ALL_TEETH){
    updateToothTooltip(toothNo);
  }
}

let i18nUnsubscribe: (() => void) | null = null;
let warningsUnsubscribe: (() => void) | null = null;

// ---- State-change subscription (extracted to ./state/notify) ----
export { onStateChange } from "./state/notify";

setPostNotifyHook(updateBridgeOverlay);

// ---- Plugin state ----
let registeredPlugins: OdontogramPlugin[] = [];
setPluginIdsProvider(() => registeredPlugins.map(p => p.id));
const pluginOverlays: PluginOverlayRegistry = new Map();


// ---- Idempotent event binding ----
// WeakMap prevents duplicate event listeners across component mount/unmount cycles.
const wiredHandlers = new WeakMap<Element, Set<string>>();
function bindOnce(el: Any, type: string, handler: Any){
  if(!el) return;
  let set = wiredHandlers.get(el);
  if(!set){ set = new Set<string>(); wiredHandlers.set(el, set); }
  if(set.has(type)) return;
  set.add(type);
  el.addEventListener(type, handler);
}
function updateWarnings(): void {
  const w = $("#warnings");
  if(!w) return;
  const isToothActive = activeTooth != null && (selectedTeeth.size === 0 || selectedTeeth.has(activeTooth));
  if(!isToothActive){
    w.innerHTML = "";
    return;
  }
  const state = toothState.get(activeTooth);
  if(!state){
    w.innerHTML = "";
    return;
  }
  const warnings = getStateWarnings(state);
  w.innerHTML = "";
  for(const msg of warnings){
    const item = el("div", { class: "warning-item", text: "⚠ " + msg });
    w.appendChild(item);
  }
}

// Maps each collapse-toggle button id to the i18n key used for its a11y label.
const CARD_TOGGLE_LABELS: Record<string, string> = {
  btnToggleStatusCard: "status.title",
  btnToggleCariesCard: "caries.title",
  btnToggleFillingCard: "filling.title",
  btnToggleRootPeriodontiumCard: "card.rootPeriodontium",
  btnToggleDiagnosesCard: "card.diagnoses",
};

// Maps each collapse-toggle button id to its session-state card id.
const BTN_TO_CARD_ID: Record<string, string> = {
  btnToggleControlsCard: "controls",
  btnToggleStatusCard: "status",
  btnToggleCariesCard: "caries",
  btnToggleFillingCard: "filling",
  btnToggleRootPeriodontiumCard: "rootPeriodontium",
  btnToggleDiagnosesCard: "diagnoses",
};

// Delegated handler for all card collapse toggles. Attached once to `document`
// so it survives React StrictMode double-mount and async init timing — per-button
// listeners wired in wireControls() proved unreliable under those conditions.
function onCardToggleClick(e: Any){
  const target = e.target as Any;
  const btn = target?.closest?.(".icon-btn");
  if(!btn) return;
  const icon = btn.querySelector(".toggle-icon");
  const cardId = BTN_TO_CARD_ID[btn.id];
  if(!cardId) return; // not a recognised card toggle button
  // Controls card collapses its actions container (uses `.hidden`), not the card.
  if(btn.id === "btnToggleControlsCard"){
    const actions = document.querySelector("#controlsActions");
    if(!actions) return;
    const hidden = actions.classList.toggle("hidden");
    applyToggleA11y(btn, "panel.controls", hidden);
    if(icon) icon.textContent = hidden ? "+" : "−";
    collapsedCards.controls = hidden;
    notifyStateChange();
    return;
  }
  const labelKey = CARD_TOGGLE_LABELS[btn.id];
  if(!labelKey) return; // not a card collapse toggle
  const card = btn.closest(".card");
  if(!card) return;
  const collapsed = card.classList.toggle("collapsed");
  applyToggleA11y(btn, labelKey, collapsed);
  if(icon) icon.textContent = collapsed ? "+" : "−";
  collapsedCards[cardId] = collapsed;
  notifyStateChange();
}

// Delegated handler for the global `setX(!current)` visibility toggles. A stable
// reference so addEventListener de-duplicates it — see onCardToggleClick.
function onGlobalToggleClick(e: Any){
  const btn = (e.target as Any)?.closest?.("button");
  if(!btn) return;
  switch(btn.id){
    case "btnWisdomVisible": setWisdomVisible(!wisdomVisible); break;
    case "btnOcclView": setOcclusalVisible(!occlusalVisible); break;
    case "btnBoneVisible": setShowBase(!showBase); break;
    case "btnPulpVisible": setHealthyPulpVisible(!showHealthyPulp); break;
  }
}


export {
  __syncInflammationModVisibilityForTest,
  __syncPeriImplantVisibilityForTest,
} from "@/engine/indicators/clinicalVisibility";



export function __perioRowHiddenForTest(s: Record<string, unknown>): boolean {
  return perioRowHidden(s);
}


function updateToothTileNumber(toothNo: Any){
  const tiles = toothTile.get(toothNo);
  if(!tiles) return;
  const text = toLabel(getDisplayedToothNumber(toothNo), numberingSystem);
  const upper = toothLabelUpper.get(toothNo);
  if(upper) upper.textContent = text;
  const lower = toothLabelLower.get(toothNo);
  if(lower) lower.textContent = text;
  // Setting textContent above wipes the note icon span; re-add it if the tooth
  // still has a note, so the icon persists across state/label updates.
  updateToothLabelNoteIcon(toothNo);
}

function updateAllToothTileNumbers(){
  for(const toothNo of ALL_TEETH){
    updateToothTileNumber(toothNo);
  }
}

// Rebuild a <select>'s options and select `value`, falling back to the first
// option when `value` isn't among them.
function setSelectOptions(selectEl: Any, options: Any, value: Any){
  if(!selectEl) return;
  selectEl.innerHTML = "";
  for(const opt of options){
    const o = el("option", { value: opt.value, text: opt.label });
    if(opt.title) o.title = opt.title;
    selectEl.appendChild(o);
  }
  if(options.some(o => o.value === value)){
    selectEl.value = value;
  }else{
    selectEl.value = options[0]?.value ?? "";
  }
}


/** TEST-ONLY: invoke `applyProposedStyling` directly on a detached, already-
 *  painted svg node (as returned by `__parseSvgForTest` + `__renderActiveLayersOnNode`),
 *  without requiring a live grid (`toothSvgRoot`/`applyStateToSvg` needs
 *  registered DOM roots — see addTile()). Reads the module's live
 *  `charts`/`chartMode`/`planInitialized`, exactly as the real
 *  `applyStateToSvg` roots loop does. Not part of the public API. */
export function __applyProposedStylingForTest(toothNo: Any, svg: Any): void {
  applyProposedStyling(toothNo, svg);
}

function applyStateToSvg(toothNo: Any){
  const roots = toothSvgRoot.get(toothNo);
  if(!roots) return;
  // Which artwork variant this tooth shows, for the profiles that ship a
  // deciduous set: the permanent drawing unless the tooth is charted as a milk
  // tooth. Roots without a `data-variant` (every classic tile, and every
  // position a milk tooth cannot occupy) are left displayed as they are.
  const wantPrimary = toothState.get(toothNo)?.toothSelection === "milktooth";
  for(const svg of roots){
    const variant = svg.getAttribute("data-variant");
    if(variant) svg.style.display = (variant === "primary") === wantPrimary ? "" : "none";
    applyStateToSvgSingle(toothNo, svg);
    applyProposedStyling(toothNo, svg); // dashed+tint plan-only layers (Plan mode only)
  }
  applyPluginOverlays(toothNo);
  updateToothTooltip(toothNo);
}


/** TEST-ONLY: render `serialized` state onto a fresh copy of `rawSvgText` and return the
 *  in-document-order active-layer fingerprint (id + opacity + class per element). Used by
 *  the parity harness; not part of the public API. */
export function __renderActiveLayers(rawSvgText: string, toothNo: number, serialized: Record<string, unknown>): { id: string; opacity: string; cls: string }[] {
  const parsed = new DOMParser().parseFromString(rawSvgText, "image/svg+xml");
  const svg = parsed.documentElement as unknown as Any;
  stripDisplayNoneToDataActive(svg);
  ensureDataActiveForSwitchables(svg);
  const state = hydrateState(serialized as Any);
  applyStateToSvgSingle(toothNo, svg, state);
  return collectActiveLayers(svg);
}

/** TEST-ONLY: parse `rawSvgText` once (same prep `__renderActiveLayers` does —
 *  strip display:none to data-active, seed missing data-active defaults) and
 *  return the live parsed element. Pair with `__renderActiveLayersOnNode` to
 *  render multiple states onto the SAME node, reproducing how the live app
 *  reuses one persistent SVG DOM node per tooth across renders (unlike
 *  `__renderActiveLayers`, which re-parses a fresh node every call and so
 *  cannot catch a render that fails to reset state a prior render left
 *  behind). Not part of the public API. */
export function __parseSvgForTest(rawSvgText: string): Any {
  const parsed = new DOMParser().parseFromString(rawSvgText, "image/svg+xml");
  const svg = parsed.documentElement as unknown as Any;
  stripDisplayNoneToDataActive(svg);
  ensureDataActiveForSwitchables(svg);
  return svg;
}

/** TEST-ONLY: hydrate `serialized` and render it onto an already-parsed `svg`
 *  node (as returned by `__parseSvgForTest`), reusing that SAME node — see
 *  `__parseSvgForTest` for why this matters. Returns the in-document-order
 *  active-layer fingerprint, same shape as `__renderActiveLayers`. Not part
 *  of the public API. */
export function __renderActiveLayersOnNode(svg: Any, toothNo: number, serialized: Record<string, unknown>): { id: string; opacity: string; cls: string }[] {
  const state = hydrateState(serialized as Any);
  applyStateToSvgSingle(toothNo, svg, state);
  return collectActiveLayers(svg);
}

/** TEST-ONLY: hydrate `raw` and store it as `toothNo`'s state directly in the
 *  module-level state map, bypassing all DOM/UI wiring (no initOdontogram()
 *  required). Lets summary/warning getters be exercised without a live SVG grid.
 *  Not part of the public API. */
export function __setToothStateForTest(toothNo: number, raw: Record<string, unknown>, version?: string): void {
  // `version` drives the legacy secondary-caries gate exactly as importStatus
  // does (per-tooth call of the same decision). Omitting it → legacy (infer).
  toothState.set(toothNo, hydrateState(raw, isLegacyPayloadVersion(version)));
  if(toothNo === activeTooth){
    updateWarnings();
  }
}

/** TEST-ONLY: convert a hydrated state object to a plain object (Sets/Maps
 *  converted to arrays/objects for easy assertions). Shared by
 *  __getToothStateForTest and the __getStatusStateForTest/
 *  __getPlanStateForTest seams below. Not part of the public API. */
function __plainStateForTest(s: Any): Record<string, unknown> {
  return {
    ...s,
    caries: Array.from(s.caries ?? []),
    fillingSurfaces: Array.from(s.fillingSurfaces ?? []),
    fillingSurfaceMaterials: Object.fromEntries(s.fillingSurfaceMaterials ?? []),
    cariesSeverity: Object.fromEntries(s.cariesSeverity ?? []),
    fillingDefect: Object.fromEntries(s.fillingDefect ?? []),
    dxOverrides: Object.fromEntries(s.dxOverrides ?? []),
    mods: Array.from(s.mods ?? []),
  };
}

/** TEST-ONLY: read back a tooth's current state as a plain object (Sets/Maps
 *  converted to arrays/objects for easy assertions). Not part of the public API. */
export function __getToothStateForTest(toothNo: number): Record<string, unknown> | undefined {
  const s = toothState.get(toothNo);
  if(!s) return undefined;
  return __plainStateForTest(s);
}

/** TEST-ONLY: read back a tooth's state from the STATUS chart regardless of
 *  which chart is currently active. Not part of the public API. */
export function __getStatusStateForTest(toothNo: number): Record<string, unknown> | undefined {
  const s = charts.status.get(toothNo);
  if(!s) return undefined;
  return __plainStateForTest(s);
}

/** TEST-ONLY: read back a tooth's state from the PLAN chart regardless of
 *  which chart is currently active. Not part of the public API. */
export function __getPlanStateForTest(toothNo: number): Record<string, unknown> | undefined {
  const s = charts.plan.get(toothNo);
  if(!s) return undefined;
  return __plainStateForTest(s);
}

/** TEST-ONLY: fully reset the dual-chart container —
 *  clears BOTH charts, drops `planInitialized`, and returns to "status"
 *  mode — without requiring a live DOM/initToken the way destroyOdontogram()
 *  does. Lets each test in a suite start from a clean slate instead of
 *  leaking `planInitialized`/chart contents across tests in the same module
 *  instance. Not part of the public API. */
export function __resetChartStateForTest(): void {
  charts.status.clear();
  charts.plan.clear();
  setPlanInitialized(false);
  clearPlanEditedTeeth();
  clearPendingDualStateConfirm();
  setActiveChartMode("status");
  resetCaseMeta();
  setCollapsedCards({});
  setSelectedTeeth(new Set());
  setActiveTooth(null);
  const w = $("#warnings");
  if(w) w.innerHTML = "";
}

export function __mirrorStatusToPlanForTest(toothNo: number): void {
  mirrorStatusToPlan(toothNo);
}

/** TEST-ONLY: drive {@link setEdentulous} directly so the gated whole-mouth
 *  structural edit can be exercised without a live DOM/initOdontogram() token.
 *  Not part of the public API. */
export function __setEdentulousForTest(on: boolean): void {
  setEdentulous(on);
}

/** TEST-ONLY: drive the single-tooth reset through the same code path as the
 *  zoom-popover / context-menu reset buttons, without a live DOM/
 *  initOdontogram() token. Not part of the public API. */
export function __resetToothForTest(toothNo: number): void {
  resetToothGated(toothNo);
}

/** TEST-ONLY: drive the multi-tooth (selection) reset through the same code
 *  path as the "Reset selected teeth" button, without a live DOM/
 *  initOdontogram() token. Not part of the public API. */
export function __resetTeethForTest(toothNos: number[]): void {
  resetTeethGated(toothNos);
}

/** TEST-ONLY: drive a dentition preset through the same
 *  code path as the #btnPrimaryDentition / #btnMixedDentition buttons, without a
 *  live DOM/initOdontogram() token. Not part of the public API. */
export function __applyDentitionPresetForTest(kind: "primary" | "mixed"): void {
  if(kind === "primary") applyPrimaryDentition();
  else applyMixedDentition();
}

// ---- Plugin overlay rendering ----
function applyPluginOverlays(toothNo: number): void {
  applyPluginOverlaysRenderer(toothNo, {
    plugins: registeredPlugins,
    roots: toothSvgRoot.get(toothNo),
    state: toothState.get(toothNo),
    overlays: pluginOverlays,
  });
}

// ---- State tooltip ----
function updateToothTooltip(toothNo: number){
  const tiles = toothTile.get(toothNo);
  if(!tiles) return;
  const summary = getStateSummary(toothNo);
  const state = toothState.get(toothNo);
  const note = notesEnabled && state?.note ? state.note : "";
  let text = summary.length > 0 ? summary.join(" · ") : "";
  if(note) text = text ? text + "\n\u{1F4DD} " + note : "\u{1F4DD} " + note;
  for(const tile of tiles){
    if(text) tile.setAttribute("title", text);
    else tile.removeAttribute("title");
  }
}

function updateToothLabelNoteIcon(toothNo: number){
  const state = toothState.get(toothNo);
  const hasNote = notesEnabled && !!state?.note;
  // Update both upper and lower label maps
  for(const labelMap of [toothLabelUpper, toothLabelLower]){
    const cell = labelMap.get(toothNo);
    if(!cell) continue;
    let icon = cell.querySelector(".tooth-note-icon") as HTMLElement | null;
    if(hasNote){
      if(!icon){
        icon = el("span", { class: "tooth-note-icon", "aria-hidden": "true" });
        icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>';
        cell.appendChild(icon);
      }
    }else{
      if(icon) icon.remove();
    }
  }
}


// ---- Control sync ----

export {
  __syncSurfaceDepthIndicatorForTest,
  __syncFillingSubcariesIndicatorForTest,
  __syncFillingDefectIndicatorForTest,
} from "@/engine/indicators/surfaceIndicators";

/** A minimal shape covering what {@link subcariesLettersForTooth} and
 *  {@link computeFillingSubcariesSummaryLine} read from a tooth state. */
// The DOM-sync writer for `#fillingDefectSummary` is retired in the same way as
// its subcaries sibling above — `FillingsCard` renders it from
// `getActiveFillings().defectSummary` (pure `computeFillingDefectSummaryLine`).

/** Toggle the wear (edge + cervical, shared wearDetailLevel) and discoloration
 *  (own discolorationDetailLevel) controls between their "complex" <select> and
 *  "simple" checkbox presentation, and derive each checkbox's `.checked` from
 *  the stored value. Non-collapsing: this ONLY flips `.hidden`/`.checked` — it
 *  never mutates `state`, so switching levels back and forth cannot lose/rewrite
 *  a stored value. A small standalone sync called from syncControlsFromState. */
function syncToothDetailControls(state: Any): void {
  const wearSimple = getWearDetailLevel() === "simple";
  $("#wearEdgeSelectLabel").classList.toggle("hidden", wearSimple);
  $("#wearEdgeToggleLabel").classList.toggle("hidden", !wearSimple);
  $("#wearCervicalSelectLabel").classList.toggle("hidden", wearSimple);
  $("#wearCervicalToggleLabel").classList.toggle("hidden", !wearSimple);
  ($("#wearEdgeToggle") as HTMLInputElement).checked = state.wearEdge !== "none";
  ($("#wearCervicalToggle") as HTMLInputElement).checked = state.wearCervical !== "none";
  const discoSimple = getDiscolorationDetailLevel() === "simple";
  $("#discolorationSelectLabel").classList.toggle("hidden", discoSimple);
  $("#discolorationToggleLabel").classList.toggle("hidden", !discoSimple);
  ($("#discolorationToggle") as HTMLInputElement).checked = state.discoloration !== "none";
}

/** TEST-ONLY: apply `syncToothDetailControls` to a hand-built DOM
 *  fragment (the wear/discoloration select+toggle labels and checkboxes),
 *  without requiring a live initOdontogram(). Mirrors
 *  __syncInflammationModVisibilityForTest. Not part of the public API. */
export function __syncToothDetailControlsForTest(state: Record<string, unknown>): void {
  syncToothDetailControls(state);
}

/** TEST-ONLY: apply `syncPerioRow` to a hand-built #perioRow DOM
 *  fragment for a given `toothNo`, without requiring a live initOdontogram()
 *  or a real `activeTooth`. Mirrors __syncToothDetailControlsForTest /
 *  __syncInflammationModVisibilityForTest. Not part of the public API. */
export function __syncPerioRowForTest(state: Record<string, unknown>, toothNo: number): void {
  syncPerioRow(state, toothNo);
}

/** TEST-ONLY: apply `buildPerioGrid` to a hand-built container, without
 *  requiring a live initOdontogram() (there is no full-DOM mount harness for
 *  the tooth panel). Lets a test verify the real grid-building DOM shape
 *  (ids/data-attributes/types) that
 *  production wireControls() builds once at init. Not part of the public API. */
export function __buildPerioGridForTest(container: Element): void {
  buildPerioGrid(container);
}

/**
 * Synchronize imperative control sub-elements (perio probing row, surface labels, warnings)
 * from the active tooth state. Declarative card bodies are updated via reactive subscriptions.
 */
function syncControlsFromState(state: Any){
  syncPerioRow(state);
  refreshCheckLabels();
  updateWarnings();
}

// ---- Event handlers ----
function applyToSelected(fn: Any){
  if(selectedTeeth.size === 0) return;
  // Route the whole selection edit through the batch gate — in plan mode every
  // selected tooth is marked plan-edited; in status mode (plan initialized) every
  // selected tooth that is NOT already plan-edited mirrors status->plan after the
  // batch (planned teeth diverge). Uninitialized plan is a pure passthrough.
  const toothNos = Array.from(selectedTeeth) as number[];
  gateToothEditBatch(toothNos, () => {
    for(const toothNo of toothNos){
      const s = toothState.get(toothNo);
      if(!s) continue;
      fn(s, toothNo);
      applyStateToSvg(toothNo);
      updateToothTileNumber(toothNo);
    }
    if(activeTooth && selectedTeeth.has(activeTooth)){
      syncControlsFromState(toothState.get(activeTooth));
    }
    if(edentulous && !suppressEdentulousSync){
      setEdentulous(false);
    }
    updateSelectionFilterButtons();
    notifyStateChange();
  });
}

/**
 * Reset a single tooth to default state, routed through the dual-state edit gate.
 * Triggers confirmation if the tooth has been edited in Plan mode.
 */
function resetToothGated(toothNo: number): void {
  gateToothEdit(toothNo, () => {
    toothState.set(toothNo, defaultState());
    applyStateToSvg(toothNo);
    updateToothTileNumber(toothNo);
    if(activeTooth === toothNo) syncControlsFromState(toothState.get(toothNo));
  });
}

/**
 * Reset a batch of teeth to default state, routed through gateToothEditBatch.
 * Unplanned teeth mirror to Plan; planned teeth require batch confirmation.
 */
function resetTeethGated(toothNos: number[]): void {
  if(toothNos.length === 0) return;
  gateToothEditBatch(toothNos, () => {
    if(edentulous){
      setEdentulousState(false);
    }
    for(const toothNo of toothNos){
      toothState.set(toothNo, defaultState());
      applyStateToSvg(toothNo);
      updateToothTileNumber(toothNo);
    }
    if(activeTooth){
      setControlsEnabled(true);
      syncControlsFromState(toothState.get(activeTooth));
    }
    notifyStateChange();
  });
}

/**
 * Reset all teeth and case metadata to a blank-slate default state.
 */
export function resetMouth(): void {
  setEdentulous(false);
  resetCaseMeta();
  for(const toothNo of ALL_TEETH){
    toothState.set(toothNo, defaultState());
    applyStateToSvg(toothNo);
    updateToothTileNumber(toothNo);
  }
  if(activeTooth){
    setControlsEnabled(true);
    syncControlsFromState(toothState.get(activeTooth));
  }
  notifyStateChange();
}

/**
 * Apply the primary (deciduous) dentition preset across the dental formula.
 * Gated batch edit: only actually changed teeth trigger plan-editing/mirroring.
 */
export function applyPrimaryDentition(): void {
  const changed = ALL_TEETH.filter(tn => JSON.stringify(serializeState(toothState.get(tn) ?? defaultState())) !== JSON.stringify(serializeState(calculatePrimaryDentitionTarget(tn))));
  gateToothEditBatch(changed, ()=>{
    setEdentulousState(false);
    setSuppressEdentulousSyncState(true);
    for(const toothNo of ALL_TEETH){
      toothState.set(toothNo, calculatePrimaryDentitionTarget(toothNo));
      applyStateToSvg(toothNo);
      updateToothTileNumber(toothNo);
    }
    setSuppressEdentulousSyncState(false);
    if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
    notifyStateChange();
  });
}

/**
 * Apply the mixed dentition preset across the dental formula.
 * Gated batch edit: only actually changed teeth trigger plan-editing/mirroring.
 */
export function applyMixedDentition(): void {
  const changed = ALL_TEETH.filter(tn => JSON.stringify(serializeState(toothState.get(tn) ?? defaultState())) !== JSON.stringify(serializeState(calculateMixedDentitionTarget(tn))));
  gateToothEditBatch(changed, ()=>{
    setEdentulousState(false);
    setSuppressEdentulousSyncState(true);
    for(const toothNo of ALL_TEETH){
      toothState.set(toothNo, calculateMixedDentitionTarget(toothNo));
      applyStateToSvg(toothNo);
      updateToothTileNumber(toothNo);
    }
    setSuppressEdentulousSyncState(false);
    if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
    notifyStateChange();
  });
}

/**
 * Enable or disable control panel inputs based on active tooth selection.
 * Gathers label[for] references in a single pass to avoid O(N) DOM querySelector costs.
 */
function setControlsEnabled(enabled: Any){
  const labelFor = new Map<string, HTMLLabelElement>();
  for(const label of Array.from(document.getElementsByTagName("label"))){
    const target = label.htmlFor;
    if(target && !labelFor.has(target)) labelFor.set(target, label);
  }
  $$(".panel-body input, .panel-body select").forEach(el => {
    if(el.id === "statusExtraSelect") return;
    el.disabled = !enabled;
    const label = (el.closest ? el.closest("label") : null) ?? (el.id ? labelFor.get(el.id) : undefined);
    if(label) label.style.display = el.disabled ? "none" : "";
  });
}

function refreshCheckLabels(){
  for(const opt of MOD_OPTIONS){
    const label = $(`#lbl-${opt.value}`);
    if(label) label.textContent = t(opt.labelKey);
  }
  // The caries surface-cross labels/letters (#lbl-caries-*) are now owned by the
  // declarative `CariesCard` (composable-UI Tier 3, PR 3c), and the filling
  // surface-cross labels/letters (#lbl-{surface}) by the declarative
  // `FillingsCard` (composable-UI Tier 3, PR 3d) — both compute them
  // arch/notation-aware from their getters, so no imperative relabel here.
}

function refreshStatusExtraOptions(){
  const selectEl = $("#statusExtraSelect");
  if(!selectEl) return;
  const statusExtras = getStatusExtras();
  if(!statusExtras.length) return;
  const options = statusExtras.map((opt)=>({ value: opt.id, label: opt.label }));
  const value = selectEl.value || options[0]?.value;
  setSelectOptions(selectEl, options, value);
}

function refreshToggleLabels(){
  const statusCard = $("#statusCard");
  const statusToggle = $("#btnToggleStatusCard");
  if(statusCard && statusToggle){
    applyToggleA11y(statusToggle, "status.title", statusCard.classList.contains("collapsed"));
  }
  const controlsActions = $("#controlsActions");
  const controlsToggle = $("#btnToggleControlsCard");
  if(controlsActions && controlsToggle){
    applyToggleA11y(controlsToggle, "panel.controls", controlsActions.classList.contains("hidden"));
  }
  const cardConfig = [
    { card: "#cariesSection", btn: "#btnToggleCariesCard", labelKey: "caries.title" },
    { card: "#fillingSection", btn: "#btnToggleFillingCard", labelKey: "filling.title" },
    { card: "#rootPeriodontiumSection", btn: "#btnToggleRootPeriodontiumCard", labelKey: "card.rootPeriodontium" },
    { card: "#diagnosesSection", btn: "#btnToggleDiagnosesCard", labelKey: "card.diagnoses" },
  ];
  for(const cfg of cardConfig){
    const cardEl = $(cfg.card);
    const btnEl = $(cfg.btn);
    if(!cardEl || !btnEl) continue;
    applyToggleA11y(btnEl, cfg.labelKey, cardEl.classList.contains("collapsed"));
  }
}

function refreshAllSelectOptions(){
  refreshStatusExtraOptions();
  // The #toothSelect base picker, #substrateSelect, and combined #restorationSelect
  // dropdown are re-localized (and their mode-dependent option sets rebuilt) by the
  // declarative `ToothDetailsCard` (composable-UI Tier 3, PR 3f) on its React
  // re-render via `getActiveToothDetails()` — no imperative re-localize here.
  // #fillingSelect (+ #fillingSimpleDefectSelect) are re-localized by the
  // declarative `FillingsCard` (composable-UI Tier 3, PR 3d) on its React
  // re-render, like the caries/ortho selects — no imperative re-localize here.
  // The Root/perio selects (#pulpEndoSelect merged optgroups, #apicalDxSelect,
  // #periapicalTypeSelect, #resorptionSelect, #mobilitySelect, #periImplantSelect)
  // are re-localized by the declarative `RootPeriodontiumCard` (composable-UI
  // Tier 3, PR 3e) on its React re-render, like the caries/fillings/ortho
  // selects — no imperative re-localize here.
  // #cariesDepthSelect / #rootCariesSelect are re-localized by the declarative
  // `CariesCard` (composable-UI Tier 3, PR 3c) on its React re-render, like the
  // ortho/status-extra selects — no imperative re-localize here.
}

function refreshLocalizedContent(){
  refreshAllSelectOptions();
  refreshCheckLabels();
  refreshToggleLabels();
  updateActiveLabel();
  refreshArchToggleLabels();
  if(activeTooth){
    syncControlsFromState(toothState.get(activeTooth));
  }
  notifyStateChange();
}

function updateSelectionUI(){
  $$(".tooth-tile").forEach(tile => {
    const toothNo = Number(tile.dataset.tooth);
    const isSelected = selectedTeeth.has(toothNo);
    tile.classList.toggle("active", isSelected);
    if(tile.hasAttribute("role")) tile.setAttribute("aria-selected", String(isSelected));
  });
  updateSelectionFilterButtons();
  updateActiveLabel();
  if(activeTooth && selectedTeeth.has(activeTooth)){
    setControlsEnabled(true);
    syncControlsFromState(toothState.get(activeTooth));
  }else{
    syncControlsFromState(defaultState());
    setControlsEnabled(false);
  }
  // The declarative control cards re-read via onStateChange, so a selection
  // change (new active tooth) must notify — otherwise a card would keep showing
  // the previously-active tooth's state. Selection funnels through here and the
  // edit path (applyToSelected) notifies on its own, so this adds no double-fire.
  notifyStateChange();
}

// ---- Touch: Zoom Popover ----
function showZoomPopover(toothNo: number){
  showZoomPopoverOverlay(toothNo, {
    roots: toothSvgRoot.get(toothNo),
    updateSelectionUI,
    resetToothGated,
    showNoteEditor,
  });
}

// ---- Touch: Context Menu ----
function showContextMenu(toothNo: number, touch: Touch){
  showContextMenuOverlay(toothNo, touch, {
    updateSelectionUI,
    resetToothGated,
  });
}

// ---- Note Editor Popover ----
function showNoteEditor(toothNo: number){
  showNoteEditorOverlay(toothNo, {
    tiles: toothTile.get(toothNo),
    updateToothTooltip,
    updateToothLabelNoteIcon,
    notifyStateChange,
  });
}

/** Public entry point to open contextual caries severity popup for a surface on the active tooth. */
export function openCariesDepthPopup(surface: string, anchor: HTMLElement): void {
  showCariesDepthPopup(surface, anchor, activeTooth, applyToSelected);
}

/** Public entry point to open contextual filling defect popup for a surface on the active tooth. */
export function openFillingDefectPopup(surface: string, anchor: HTMLElement): void {
  showFillingDefectPopup(surface, anchor, activeTooth, applyToSelected);
}


function onToothClick(toothNo: Any, evt: Any){
  if(readOnly) return;
  const multi = evt.metaKey || evt.ctrlKey;
  if(multi){
    if(selectedTeeth.has(toothNo)){
      selectedTeeth.delete(toothNo);
    }else{
      selectedTeeth.add(toothNo);
      setActiveTooth(toothNo);
    }
  }else{
    setSelectedTeeth(new Set([toothNo]));
    setActiveTooth(toothNo);
  }
  if(activeTooth && !selectedTeeth.has(activeTooth)){
    setActiveTooth(selectedTeeth.values().next().value ?? null);
  }
  updateSelectionUI();
}

// ---- Keyboard accessibility ----
function onToothKeydown(toothNo: number, evt: KeyboardEvent): void {
  onToothKeydownNav(toothNo, evt, {
    getTiles: (tn) => toothTile.get(tn),
    onSelect: (tn, e) => onToothClick(tn, e),
    onClearSelection: () => clearSelection(),
  });
}

function updateToothTileVisibility(){
  const hiddenSet = new Set([18,28,38,48]);
  for(const toothNo of ALL_TEETH){
    const tiles = toothTile.get(toothNo);
    if(!tiles) continue;
    const hide = !wisdomVisible && hiddenSet.has(toothNo);
    for(const tile of tiles){
      tile.classList.toggle("wisdom-hidden", hide);
      if(tile.hasAttribute("role")){
        tile.setAttribute("tabindex", hide || readOnly ? "-1" : "0");
        if(hide) tile.setAttribute("aria-hidden", "true");
        else tile.removeAttribute("aria-hidden");
      }
    }
  }
  setSelectedTeeth(new Set([...selectedTeeth].filter(tn => {
    const tiles = toothTile.get(tn);
    if(!tiles || tiles.length === 0) return true;
    return !tiles.every(tile => tile.classList.contains("wisdom-hidden"));
  })));
  if(activeTooth && !selectedTeeth.has(activeTooth)){
    setActiveTooth(selectedTeeth.values().next().value ?? null);
  }
  updateSelectionUI();
}

/**
 * Set whole-mouth edentulous state. Gated batch edit that marks teeth as missing.
 * If in Plan mode, marks changed teeth as planned; in Status mode, mirrors to Plan.
 */
export function setEdentulous(on: Any){
  if(on){
    const missingKey = JSON.stringify(serializeState((()=>{ const s = defaultState(); s.toothSelection = "none"; return s; })()));
    const changed = ALL_TEETH.filter(tn => JSON.stringify(serializeState(toothState.get(tn) ?? defaultState())) !== missingKey);
    gateToothEditBatch(changed, ()=>{
      setEdentulousState(true);
      setSuppressEdentulousSyncState(true);
      for(const toothNo of ALL_TEETH){
        const s = defaultState();
        s.toothSelection = "none";
        toothState.set(toothNo, s);
        applyStateToSvg(toothNo);
        updateToothTileNumber(toothNo);
      }
      setSuppressEdentulousSyncState(false);
      if(activeTooth) syncControlsFromState(toothState.get(activeTooth));
      notifyStateChange();
    });
    return;
  }
  setEdentulousState(false);
  notifyStateChange();
}

function setWisdomVisible(on: Any){
  setWisdomVisibleState(!!on);
  setToggleButton($("#btnWisdomVisible"), wisdomVisible);
  updateToothTileVisibility();
  // Wisdom teeth fade via opacity (no size change), so the ResizeObserver won't
  // fire — redraw the bridge overlay explicitly so a span onto a wisdom tooth stays current.
  updateBridgeOverlay();
}

/** Toggle visibility of the bone/gum base layer on all teeth. */
function setShowBase(on: Any){
  setShowBaseState(on);
  setToggleButton($("#btnBoneVisible"), showBase);
  for(const toothNo of ALL_TEETH){
    applyStateToSvg(toothNo);
  }
}

/** Toggle visibility of occlusal-view tiles (premolars and molars). */
function setOcclusalVisible(on: Any){
  setOcclusalVisibleState(!!on);
  setToggleButton($("#btnOcclView"), occlusalVisible);
  $$(".tooth-tile.occl-view").forEach(tile => {
    tile.classList.toggle("occl-hidden", !occlusalVisible);
  });
  // Occlusal rows change grid height — redraw immediately instead of waiting for
  // the debounced ResizeObserver, so bridge bars don't sit at a stale Y.
  updateBridgeOverlay();
}

/** Toggle visibility of the healthy-pulp layer on all teeth. */
function setHealthyPulpVisible(on: Any){
  setHealthyPulpVisibleState(!!on);
  setToggleButton($("#btnPulpVisible"), showHealthyPulp);
  for(const toothNo of ALL_TEETH){
    applyStateToSvg(toothNo);
  }
}

export function setToothMobility(toothNo: number, value: string): void {
  if(!VALID_MOBILITY.has(value)) return;
  let s = toothState.get(toothNo);
  if(!s){ s = defaultState(); toothState.set(toothNo, s); }
  if(s.mobility === value) return;
  gateToothEdit(toothNo, () => {
    s.mobility = value;
    applyStateToSvg(toothNo);
    updateToothTileNumber(toothNo);
    if(toothNo === activeTooth) syncControlsFromState(toothState.get(toothNo));
    notifyStateChange();
  });
}

// ---- Perio-chart overlay open/close ----
// Separately-invocable imperative API so a host dental application can call up
// the perio overlay independently of the base odontogram (e.g. from its own
// menu/shortcut, without going through any odontogram-specific UI). The flag
// lives here (alongside the rest of the module-level session state) and reuses
// the existing `onStateChange` subscription — `App.tsx`'s demo subscribes and
// mirrors the flag into React state (`perioOpen`) so `<PerioChart/>` re-renders
// on open/close. No tooth-state mutation, no payload/FHIR change.
let perioOverlayOpen = false;

/** Open the perio-chart overlay. No-op (still notifies) if already open. */
export function openPerioOverlay(): void {
  perioOverlayOpen = true;
  notifyStateChange();
}

/** Close the perio-chart overlay. No-op (still notifies) if already closed. */
export function closePerioOverlay(): void {
  perioOverlayOpen = false;
  notifyStateChange();
}

/** Whether the perio-chart overlay is currently open. */
export function isPerioOverlayOpen(): boolean {
  return perioOverlayOpen;
}

export function importStatus(data: Any){
  if(!data || typeof data !== "object") return;
  hydrateImportedCharts(data);
  resetActiveChartToStatusAfterImport();
  // Full repaint-all — now guaranteed to draw the just-imported STATUS chart
  // regardless of which chart was active before the import.
  for(const toothNo of ALL_TEETH){
    applyStateToSvg(toothNo);
    updateToothTileNumber(toothNo);
    updateToothLabelNoteIcon(toothNo);
  }
  if(data.globals){
    if(typeof data.globals.wisdomVisible === "boolean") setWisdomVisible(data.globals.wisdomVisible);
    if(typeof data.globals.showBase === "boolean") setShowBase(data.globals.showBase);
    if(typeof data.globals.occlusalVisible === "boolean") setOcclusalVisible(data.globals.occlusalVisible);
    if(typeof data.globals.showHealthyPulp === "boolean") setHealthyPulpVisible(data.globals.showHealthyPulp);
    if(typeof data.globals.edentulous === "boolean"){
      setEdentulousState(data.globals.edentulous);
    }
  }
  updateSelectionFilterButtons();
  updateSelectionUI();
  notifyStateChange();
  syncChartModeUi();
}

/** TEST-ONLY: exercise the DATA-ONLY import hydrate (status-primary teeth +
 *  conditional plan restore + planInitialized), without requiring a live
 *  DOM/initOdontogram() token. Not part of the public API. */
export function importFhirBundle(input: Any){
  let bundle = input;
  if(typeof input === "string"){
    try{ bundle = JSON.parse(input); }catch(e){ console.error("Invalid FHIR JSON", e); return; }
  }
  const payload = parseFhirBundle(bundle);
  importStatus(payload);
}

export function applyStatusExtra(option: Any){
  const changes = calculateStatusPresetChanges(option, {
    getCurrentState: (toothNo) => toothState.get(toothNo),
    getStatusExtrasMeta,
  });
  if (!changes) return;

  // Keep only teeth whose FINAL next state differs from what is committed now —
  // this uniformly drops the three no-op cases (wisdom skip, predicate
  // mismatch, unchanged value) so the gate never marks/mirrors an unchanged
  // tooth (mirroring how setPerioSite/setFurcation/setPlaque signal `changed`).
  const entries = [...changes.entries()].filter(([toothNo, next]) =>
    JSON.stringify(serializeState(next)) !== JSON.stringify(serializeState(toothState.get(toothNo) ?? defaultState())));
  const changed = entries.map(([toothNo]) => toothNo);
  gateToothEditBatch(changed, ()=>{
    for(const [toothNo, next] of entries){
      toothState.set(toothNo, next);
      applyStateToSvg(toothNo);
      updateToothTileNumber(toothNo);
    }
    if(activeTooth){
      syncControlsFromState(toothState.get(activeTooth));
    }
    updateSelectionFilterButtons();
    // applyStateToSvg only touches per-tooth SVG; notifyStateChange() is what
    // drives updateBridgeOverlay() (the bridge-span connector) + every
    // listener. Fire it ONCE here, after all changed teeth are applied — and
    // INSIDE the gated closure so it runs when the batch actually applies
    // (synchronously on the immediate path; on Accept for a deferred confirm),
    // never while the confirm is still pending.
    notifyStateChange();
  });
}

/** TEST-ONLY: apply a clinical status-extra preset (span/arch-bridge/removable/
 *  bar-denture) directly against the module-level state map. Not part of the
 *  public API. */
export function __applyStatusExtraForTest(option: Any): void {
  applyStatusExtra(option);
}

// ---- Load and build grid ----
let initialized = false;
let initToken = 0;

// `svgText` is the inlined SVG markup from a `?raw` import (see TEMPLATES) —
// parsed directly, never fetched. Kept `async` so existing `await loadSvg(...)`
// call sites are unchanged.
async function loadSvg(svgText: Any){
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  // Normalize ids/attrs
  stripDisplayNoneToDataActive(svg);
  ensureDataActiveForSwitchables(svg);
  return svg;
}

async function buildGrid(token: number){
  if(!initialized || token !== initToken) return;
  const grid = $("#toothGrid");
  if(!grid) return;
  grid.innerHTML = "";

  // Read the active anatomy profile for the template maps + tpl/occl lists. For
  // the classic profile these are the same objects/values as the module-level
  // constants, so the built DOM is byte-identical to before this refactor.
  const profile = activeAnatomyProfile();

  // The DOM node the tile/label builders append into. For the classic
  // `uniform16` layout it stays `grid` for the whole build, so the produced DOM
  // is byte-identical to before this refactor. The `twoArch` layout reassigns it
  // to the upper- then lower-arch sub-grid, so the SHARED builders below need no
  // duplication — only the arrangement (which container) differs.
  let appendTarget: Any = grid;

  // preload SVG templates in parallel
  const tplCache = new Map();
  const occlCache = new Map();
  // The deciduous set is OPTIONAL — only a profile that draws milk teeth as
  // their own templates populates it, and then only for the positions a milk
  // tooth can occupy. Both caches stay empty for a profile without one, and
  // every lookup below then simply finds nothing.
  const primaryTplCache = new Map();
  const primaryOcclCache = new Map();
  const tplNos = profile.tplNos;
  const occlNos = profile.occlNos;
  const primaryTemplates = profile.primaryTemplates;
  const primaryTemplatesOccl = profile.primaryTemplatesOccl;
  await Promise.all([
    ...tplNos.map(async (tplNo) => {
      tplCache.set(tplNo, await loadSvg(profile.templates[tplNo]));
    }),
    ...occlNos.map(async (tplNo) => {
      occlCache.set(tplNo, await loadSvg(profile.templatesOccl[tplNo]));
    }),
    ...(primaryTemplates ? (profile.primaryTplNos ?? []).map(async (tplNo) => {
      primaryTplCache.set(tplNo, await loadSvg(primaryTemplates[tplNo]));
    }) : []),
    ...(primaryTemplatesOccl ? (profile.primaryOcclNos ?? []).map(async (tplNo) => {
      primaryOcclCache.set(tplNo, await loadSvg(primaryTemplatesOccl[tplNo]));
    }) : []),
  ]);
  if(!initialized || token !== initToken) return;

  /** Clone one cached template into an oriented, tile-ready svg node. */
  function instantiate(cache: Any, tplNo: Any, rot: Any, mirror: Any){
    const tpl = cache.get(tplNo);
    if(!tpl) return null;
    const svg = tpl.cloneNode(true);
    if(rot === 180) rotate180(svg);
    if(mirror) mirrorVertical(svg);
    return svg;
  }

  function addTile({toothNo, tplNo, rot, mirror, view, clickable}: Any){
    if(!initialized || token !== initToken) return;
    const svg = instantiate(view === "occl" ? occlCache : tplCache, tplNo, rot, mirror);
    if(!svg) return;

    const tileClasses = [
      "tooth-tile",
      `tpl-${tplNo}`,
      toothNo >= 31 ? "lower-row" : "upper-row",
      view === "occl" ? "occl-view" : "side-view"
    ];
    if(!clickable) tileClasses.push("placeholder");

    const tile = el("div", { class: tileClasses.join(" "), "data-tooth": String(toothNo) }, [
      el("div", { class:"tooth-svg" })
    ]);
    $(".tooth-svg", tile).appendChild(svg);

    // A position that can carry a milk tooth gets its DECIDUOUS drawing as a
    // second root in the SAME tile, and `applyStateToSvg` displays exactly one
    // of the two. Both are painted from the same state, so switching a tooth
    // to or from `milktooth` is an instant flip that touches no DOM structure:
    // the tile, its listeners, its selection/focus state and its registry
    // entries all survive, which a per-tooth rebuild would have to reconstruct.
    // Profiles without a deciduous set (classic) produce exactly one root and
    // no `data-variant` attribute, so nothing about them changes.
    const roots = [svg];
    const primaryMap = view === "occl"
      ? profile.primaryOcclusalTemplate?.get(toothNo)
      : profile.primaryToothTemplate?.get(toothNo);
    if(primaryMap){
      const primarySvg = instantiate(
        view === "occl" ? primaryOcclCache : primaryTplCache,
        primaryMap.tpl, primaryMap.rot, primaryMap.mirror,
      );
      if(primarySvg){
        svg.setAttribute("data-variant", "permanent");
        primarySvg.setAttribute("data-variant", "primary");
        $(".tooth-svg", tile).appendChild(primarySvg);
        roots.push(primarySvg);
      }
    }

    if(clickable){
      tile.addEventListener("click", (e)=>onToothClick(toothNo, e));
      tile.addEventListener("dblclick", ()=>{
        if(!notesEnabled || readOnly) return;
        showNoteEditor(toothNo);
      });
      tile.addEventListener("keydown", (e)=>onToothKeydown(toothNo, e));
      if(view === "side"){
        tile.setAttribute("role", "option");
        tile.setAttribute("aria-selected", "false");
        tile.setAttribute("tabindex", readOnly ? "-1" : "0");
        tile.setAttribute("aria-label", toLabel(toothNo, numberingSystem));
      }
      if(isTouchDevice()){
        addTouchToTile(tile, toothNo, {
          onShortTap: (tn) => showZoomPopover(tn),
          onLongPress: (tn, touch) => showContextMenu(tn, touch),
        });
      }
    }else{
      tile.removeAttribute("data-tooth");
    }

    appendTarget.appendChild(tile);

    if(!toothSvgRoot.has(toothNo)) toothSvgRoot.set(toothNo, []);
    // Note: a tile with a deciduous variant contributes TWO svg roots but ONE
    // tile, so the two registries are no longer index-aligned. Nothing may zip
    // them by position — find a root's tile through the DOM instead.
    for(const root of roots) toothSvgRoot.get(toothNo).push(root);
    if(!toothTile.has(toothNo)) toothTile.set(toothNo, []);
    toothTile.get(toothNo).push(tile);

    if(!toothState.has(toothNo)) toothState.set(toothNo, defaultState());
    applyStateToSvg(toothNo);
  }

  function addRowSide(rowTeeth: Any){
    for(const toothNo of rowTeeth){
      const map = profile.toothTemplate.get(toothNo);
      const tplNo = map ? map.tpl : 16;
      addTile({ toothNo, tplNo, rot: map?.rot ?? 0, mirror: map?.mirror ?? false, view: "side", clickable: true });
    }
  }

  function occlTemplateForTooth(toothNo: Any){
    if([14,15,24,25,34,35,44,45].includes(toothNo)) return 14;
    if([16,17,18,26,27,28,36,37,38,46,47,48].includes(toothNo)) return 16;
    return null;
  }

  function addPlaceholderTile(){
    const tile = el("div", { class:"tooth-tile occl-view placeholder" }, [
      el("div", { class:"tooth-svg" })
    ]);
    appendTarget.appendChild(tile);
  }

  function addRowOccl(rowTeeth: Any, placeholders: Any){
    for(const toothNo of rowTeeth){
      // A profile that splits front/occlusal artwork (measured) supplies its own
      // `occlusalTemplate` — a lower posterior occlusal is a separate drawing,
      // NOT an upper one rotated, so tpl+rot+mirror all come from that map.
      // Classic has no `occlusalTemplate`, so it keeps its historical mapping
      // (occlTemplateForTooth for tpl, the front map's rot/mirror) → identical DOM.
      if(profile.occlusalTemplate){
        const map = profile.occlusalTemplate.get(toothNo);
        if(placeholders.has(toothNo) || !map){
          addPlaceholderTile();
          continue;
        }
        addTile({ toothNo, tplNo: map.tpl, rot: map.rot, mirror: map.mirror, view: "occl", clickable: true });
        continue;
      }
      const map = profile.toothTemplate.get(toothNo);
      const tplNo = occlTemplateForTooth(toothNo);
      if(placeholders.has(toothNo) || !tplNo || !map){
        addPlaceholderTile();
        continue;
      }
      addTile({ toothNo, tplNo, rot: map.rot, mirror: map.mirror, view: "occl", clickable: true });
    }
  }

  function addLabelRow(rowTeeth: Any, targetMap: Any){
    const row = el("div", { class:"tooth-label-row", "aria-hidden":"true" });
    for(const toothNo of rowTeeth){
      const cell = el("div", { class:"tooth-label-cell", text: toLabel(toothNo, numberingSystem), tabindex:"-1" });
      cell.addEventListener("click", (e)=>onToothClick(toothNo, e));
      row.appendChild(cell);
      targetMap.set(toothNo, cell);
    }
    appendTarget.appendChild(row);
  }

  const upperSide = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
  const lowerSide = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];
  const upperOcclPlaceholders = new Set([13,12,11,21,22,23]);
  const lowerOcclPlaceholders = new Set([43,42,41,31,32,33]);

  if(!initialized || token !== initToken) return;
  // Layout assembly branches on the profile. Classic = the flat, single
  // `#toothGrid` uniform-16 grid (identical DOM). Measured = two per-arch grids
  // (`.upper-arch`/`.lower-arch`) so each tooth gets its own anatomical width.
  if(profile.layout === "twoArch"){
    // Two arch sub-grids nested in `#toothGrid`. `role="presentation"` keeps the
    // tiles as children of the listbox in the accessibility tree while the flex
    // column + per-arch grid columns (CSS, keyed on `[data-anatomy="measured"]`)
    // give each tooth its measured width. The SHARED builders append into
    // whichever arch `appendTarget` points at.
    const upperArch = el("div", { class:"tooth-arch upper-arch", role:"presentation" });
    const lowerArch = el("div", { class:"tooth-arch lower-arch", role:"presentation" });
    grid.appendChild(upperArch);
    grid.appendChild(lowerArch);

    appendTarget = upperArch;
    addLabelRow(upperSide, toothLabelUpper);
    addRowSide(upperSide);
    addRowOccl(upperSide, upperOcclPlaceholders);

    appendTarget = lowerArch;
    addRowOccl(lowerSide, lowerOcclPlaceholders);
    addRowSide(lowerSide);
    addLabelRow(lowerSide, toothLabelLower);

    appendTarget = grid;
  }else{
    addLabelRow(upperSide, toothLabelUpper);
    addRowSide(upperSide);
    addRowOccl(upperSide, upperOcclPlaceholders);
    addRowOccl(lowerSide, lowerOcclPlaceholders);
    addRowSide(lowerSide);
    addLabelRow(lowerSide, toothLabelLower);
  }

  // addTile() repainted each tooth from state; the label cells are fresh, so
  // a rebuild (re-init, anatomy change, perio round-trip) must restore the
  // note icons the same way, or a charted note shows up with no badge.
  for(const toothNo of ALL_TEETH){
    updateToothLabelNoteIcon(toothNo);
  }

  // ARIA on grid container
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-multiselectable", "true");

  // start with no tooth selected
  setSelectedTeeth(new Set());
  setActiveTooth(null);
  updateSelectionUI();
  updateToothTileVisibility();
  setOcclusalVisible(occlusalVisible);
  setHealthyPulpVisible(showHealthyPulp);

  // Wire touch interactions
  if(isTouchDevice()){
    grid.addEventListener("touchstart", onGridTouchStart, { passive: false });
    grid.addEventListener("touchmove", onGridTouchMove, { passive: false });
    grid.addEventListener("touchend", onGridTouchEnd);
    buildArchToggle();
  }
}

export { setImportFormat };

// ---- Controls wiring ----
function wireControls(){
  // Collapse toggles and the global visibility toggles use delegated listeners
  // with stable function references, so addEventListener de-duplicates them.
  // Register on every init because destroyOdontogram removes them; the DOM
  // guarantees only one live listener each. These handle the `setX(!current)`
  // toggles that would otherwise cancel themselves out under React StrictMode's
  // double mount-effect (which re-wires anonymous listeners onto the same nodes).
  document.addEventListener("click", onCardToggleClick);
  document.addEventListener("click", onGlobalToggleClick);
  // wireControls() is fully re-entrant: the buildSelect/buildChecks/
  // buildSurfaceCross/buildPerioGrid builders skip already-populated containers,
  // every persistent-node listener goes through bindOnce (per-element idempotent),
  // and loadInlineIcon/export-import `.onclick=` assignments are self-idempotent.
  // So a remounted surface re-runs this to wire only its fresh nodes, while
  // still-mounted nodes are left untouched — no module-level "wired once" flag.
  const iconButtons = ["btnOcclView","btnWisdomVisible","btnBoneVisible","btnPulpVisible"];
  iconButtons.forEach((id)=>{
    const btn = $(`#${id}`);
    if(btn) loadInlineIcon(btn).then(()=>syncIconXLine(btn));
  });

  // The Tooth-details card body (#toothSelect base picker, #substrateSelect,
  // the combined #restorationSelect dropdown, the extraction/missing/broken/
  // contact/crown-leakage/bridge/crown-replace/crown-needed checkboxes, the
  // wear/discoloration select-vs-toggle rows, and the #crownActionsRow with its
  // reparented #extractionPlanRow) is now the declarative `ToothDetailsCard`
  // (composable-UI Tier 3, PR 3f): rendered from `getActiveToothDetails()` and
  // written through `setToothSelectionForSelection`/`setSubstrateForSelection`/
  // `setRestorationForSelection` + the per-axis toggle setters; the title
  // `#btnResetTooth` button calls `resetTooth()` — no imperative wiring here.

  // Root card (#rpRootBlock body: the merged pulp/endo optgroup select, the
  // apical diagnosis / periapical lesion / root-resorption selects, and the
  // resection + parapulpal-pin checkboxes) is now the declarative
  // `RootPeriodontiumCard` (composable-UI Tier 3, PR 3e): rendered from
  // `getActiveRootPerio()` and written through `setPulpEndoForSelection`/
  // `setApicalDxForSelection`/`setPeriapicalTypeForSelection`/
  // `setResorptionForSelection`/`setEndoResectionForSelection`/
  // `setParapulpalPinForSelection` — no imperative wiring here.

  // Mobility, the inflammation/parodontal mod checkboxes (#modsChecks), the
  // periapical lesion-subtype select, the calculus toggle, and the peri-implant
  // select are now the declarative `RootPeriodontiumCard` (composable-UI Tier 3,
  // PR 3e), rendered from `getActiveRootPerio()` and written through
  // `setMobilityForSelection`/`setModForSelection`/`setPeriapicalTypeForSelection`/
  // `setCalculusForSelection`/`setPeriImplantForSelection`.

  // The 6-site PD/GM/BOP/SUP grid stays IMPERATIVE (Tier 3 PR 3e carve-out) —
  // built once here (site identities are static), values synced per-tooth by
  // syncPerioRow() inside syncControlsFromState(). See buildPerioGrid's own doc
  // comment.
  buildPerioGrid($("#perioGrid"));

  // Caries card (#cariesSection body) is now the declarative `CariesCard`
  // (composable-UI Tier 3, PR 3c): its surface-cross, subcrown row, depth select,
  // root-caries select, and `.surf-depth` severity-popup indicators are rendered
  // from `getActiveCaries()` and written through `setCariesSurfaceForSelection`/
  // `setCariesActiveDepthForSelection`/`setRootCariesForSelection`/
  // `openCariesDepthPopup` — no imperative wiring here.

  // Fillings card (#fillingSection body) is now the declarative `FillingsCard`
  // (composable-UI Tier 3, PR 3d): its material select, surface cross (with the
  // RIGHT-side recurrent-caries `.surf-depth` and LEFT-side `.surf-defect`
  // indicators), the simple/complex swap, the simple-mode defect select, and the
  // fissure-sealing toggle are rendered from `getActiveFillings()` and written
  // through `setFillingMaterialForSelection`/`setFillingSurfaceForSelection`/
  // `setFillingSimpleToggleForSelection`/`setFillingSimpleDefectForSelection`/
  // `setFissureSealingForSelection` + `openCariesDepthPopup`/`openFillingDefectPopup`
  // — no imperative wiring here.

  // Ortho appliance/drift/vertical pickers + rotation toggle are now wired
  // declaratively by `OrthodonticsCard` (composable-UI Tier 3) through
  // `setOrtho*ForSelection`; no imperative `#orthoCard` binding here.

  // The Statuses card body (#btnResetAll / #btnPrimaryDentition /
  // #btnMixedDentition / #btnEdentulous + the #statusExtraSelect/#statusExtraApply
  // row) is now the declarative `StatusesCard` (composable-UI Tier 3, PR 3b): it
  // calls resetMouth()/applyPrimaryDentition()/applyMixedDentition()/setEdentulous()
  // and applyStatusExtra() directly through the engine API and reads getStatusExtras()
  // for its options — no imperative wiring here anymore.

  bindSelectionControls({
    bindOnce,
    updateToothTileVisibility,
    updateSelectionUI,
  });

  // Status | Plan chart-mode toggle (chart-header, separate from both the topbar
  // and the right Controls panel).
  bindOnce($("#chartModeStatus"), "click", ()=>setChartMode("status"));
  bindOnce($("#chartModePlan"), "click", ()=>setChartMode("plan"));

  // The global visibility toggles (wisdom / occlusal / bone / pulp) are handled
  // by the delegated onGlobalToggleClick listener registered above. (#btnEdentulous
  // is now the declarative StatusesCard's own onClick — composable-UI Tier 3.)

  // Card collapse toggles use a single delegated listener on `document` (see
  // onCardToggleClick). Here we only set the initial a11y labels to match each
  // card's current collapsed state; the click handling is delegation-based.
  const statusCard = $("#statusCard");
  const statusToggle = $("#btnToggleStatusCard");
  if(statusCard && statusToggle){
    applyToggleA11y(statusToggle, "status.title", statusCard.classList.contains("collapsed"));
  }
  const controlsToggle = $("#btnToggleControlsCard");
  const controlsActions = $("#controlsActions");
  if(controlsToggle && controlsActions){
    applyToggleA11y(controlsToggle, "panel.controls", controlsActions.classList.contains("hidden"));
  }
  [
    { card: "#cariesSection", btn: "#btnToggleCariesCard", labelKey: "caries.title" },
    { card: "#fillingSection", btn: "#btnToggleFillingCard", labelKey: "filling.title" },
    { card: "#rootPeriodontiumSection", btn: "#btnToggleRootPeriodontiumCard", labelKey: "card.rootPeriodontium" },
    { card: "#diagnosesSection", btn: "#btnToggleDiagnosesCard", labelKey: "card.diagnoses" },
  ].forEach(({card, btn, labelKey})=>{
    const cardEl = $(card);
    const btnEl = $(btn);
    if(!cardEl || !btnEl) return;
    applyToggleA11y(btnEl, labelKey, cardEl.classList.contains("collapsed"));
  });

  bindChartTransferControls({
    importStatus,
    importFhirBundle,
  });
}

/**
 * Switch the displayed tooth numbering system and re-render all tooth labels.
 * @param system - The target {@link NumberingSystem}.
 */
/** The numbering system currently displayed. Defaults to `"FDI"`. */
export function getNumberingSystem(): NumberingSystem { return numberingSystem; }

export function setNumberingSystem(system: NumberingSystem){
  if(!applyNumberingSystem(system)) return;
  updateAllToothTileNumbers();
  updateActiveLabel();
  notifyStateChange();
}

/**
 * Initialise the odontogram engine: wire up DOM controls, build the SVG tooth
 * grid, and start listening for i18n changes. Safe to call multiple times
 * (subsequent calls are no-ops).
 */
export async function initOdontogram(){
  if(initialized) return;
  initialized = true;
  const token = ++initToken;
  wireControls();
  await buildGrid(token);
  if(!initialized || token !== initToken) return;
  if(!i18nUnsubscribe){
    i18nUnsubscribe = onI18nChange(()=>refreshLocalizedContent());
  }
  if(!warningsUnsubscribe){
    warningsUnsubscribe = onStateChange(()=>updateWarnings());
  }
  refreshLocalizedContent();
  // ensure controls match initial active tooth (if any)
  if(activeTooth != null){
    const state = toothState.get(activeTooth);
    if(state){
      syncControlsFromState(state);
    }
  }
  setupBridgeOverlayResize();
  notifyStateChange();
  // Reflect the initial chart mode ("status") in the toggle UI on first mount,
  // same as any other setChartMode()-driven sync.
  syncChartModeUi();
}

/**
 * Tear down the odontogram engine: clear all DOM elements built by the engine,
 * unsubscribe from i18n changes, and reset internal state. After this call,
 * {@link initOdontogram} may be called again to re-initialise.
 */
export function destroyOdontogram(){
  if(!initialized) return;
  initialized = false;
  initToken++;
  teardownBridgeOverlayResize();
  document.removeEventListener("click", onCardToggleClick);
  document.removeEventListener("click", onGlobalToggleClick);
  if(i18nUnsubscribe){
    i18nUnsubscribe();
    i18nUnsubscribe = null;
  }
  if(warningsUnsubscribe){
    warningsUnsubscribe();
    warningsUnsubscribe = null;
  }
  const w = $("#warnings");
  if(w) w.innerHTML = "";
  // Clear DOM fragments built by the odontogram engine
  const grid = $("#toothGrid") as HTMLElement | null;
  if(grid){
    destroyTouchGestures(grid);
    grid.innerHTML = "";
  }else{
    destroyTouchGestures();
  }
  hideZoomPopover();
  hideContextMenu();
  hideNoteEditor();
  setReadOnlyState(false);
  setNotesEnabledRaw(false);
  pluginOverlays.clear();
  // The imperatively-built control containers (#modsChecks / #cariesChecks /
  // #cariesSubcrownRow / #fillingSurfaceChecks / #statusExtraSelect) are NOT
  // emptied here: with the "skip if populated" builder guards, emptying them then
  // skipping-rebuild on a DOM-persisting re-init would leave them permanently
  // empty. Leaving them populated is correct — re-init skips the rebuild and
  // syncControlsFromState() refreshes their values.
  // A full teardown resets the whole case — BOTH charts, not just the active one
  // — and drops back to "status" mode so a subsequent initOdontogram() starts
  // clean.
  charts.status.clear();
  charts.plan.clear();
  setPlanInitialized(false);
  clearPlanEditedTeeth();
  clearPendingDualStateConfirm();
  setActiveChartMode("status");
  resetCaseMeta();
  toothSvgRoot.clear();
  toothTile.clear();
  toothLabelUpper.clear();
  toothLabelLower.clear();
  setSelectedTeeth(new Set());
  setActiveTooth(null);
}

/**
 * Re-run control wiring after a controls surface remounts (composable-UI Tier 2).
 * `wireControls()` is idempotent per-element (bindOnce + populated-container
 * guards), so this wires ONLY the freshly-mounted nodes and leaves still-mounted
 * ones untouched; the trailing syncControlsFromState() re-derives the active
 * tooth's per-tooth option lists/values on the (possibly new) select nodes.
 * No-op before init (the provider's own init effect does the first wiring).
 */
export function rewireControls(){
  if(!initialized) return;
  wireControls();
  if(activeTooth != null){
    const s = toothState.get(activeTooth);
    if(s) syncControlsFromState(s);
  } else {
    updateWarnings();
  }
}

/**
 * Rebuild the SVG tooth grid after the chart column remounts (composable-UI
 * Tier 2). Preserves the current selection/active tooth across buildGrid()'s
 * internal reset, clears+rebuilds the four grid element maps, and bumps
 * `initToken` so any in-flight/toggle-spam build supersedes cleanly. No-op
 * before init or if a newer build/teardown supersedes this one mid-await.
 */
export async function rebuildGrid(){
  if(!initialized) return;
  const savedSelected = new Set(selectedTeeth);
  const savedActive = activeTooth;
  // A remounted #toothGrid has fresh DOM; drop the stale element references so
  // buildGrid() repopulates them (the clear precedes the await, so a superseded
  // build never restores stale maps).
  toothSvgRoot.clear();
  toothTile.clear();
  toothLabelUpper.clear();
  toothLabelLower.clear();
  pluginOverlays.clear();
  const token = ++initToken;
  await buildGrid(token);
  if(!initialized || token !== initToken) return;
  // buildGrid()'s tail resets selection/active to empty — restore what the user had.
  setSelectedTeeth(savedSelected);
  setActiveTooth(savedActive);
  updateSelectionUI();
  setupBridgeOverlayResize(); // re-observe the new grid node
  if(activeTooth != null){
    const s = toothState.get(activeTooth);
    if(s) syncControlsFromState(s);
  }
}

/**
 * Register one or more custom SVG plugins. Plugins can inject visual overlays
 * into the tooth SVG and maintain per-tooth custom state included in export/import.
 *
 * @param plugins - Array of {@link OdontogramPlugin} definitions.
 */
export function registerPlugins(plugins: OdontogramPlugin[]){
  registeredPlugins = [...plugins];
  // Re-render plugin overlays for all teeth
  for(const toothNo of ALL_TEETH){
    applyPluginOverlays(toothNo);
    updateToothTooltip(toothNo);
  }
}

/**
 * Set a plugin's custom state for a specific tooth. Triggers SVG re-render
 * for that tooth and updates the tooltip.
 *
 * @param toothNo - The FDI tooth number (11–48).
 * @param pluginId - The plugin's unique identifier.
 * @param value - The custom state value (any JSON-serializable value, or `undefined` to clear).
 */
export function setPluginState(toothNo: number, pluginId: string, value: unknown){
  const state = toothState.get(toothNo);
  if(!state) return;
  if(value === undefined){
    delete state.customStates[pluginId];
  }else{
    state.customStates[pluginId] = value;
  }
  applyStateToSvg(toothNo);
  updateToothTileNumber(toothNo);
}

/**
 * Get a plugin's custom state for a specific tooth.
 *
 * @param toothNo - The FDI tooth number (11–48).
 * @param pluginId - The plugin's unique identifier.
 * @returns The custom state value, or `undefined` if not set.
 */
export function getPluginState(toothNo: number, pluginId: string): unknown{
  const state = toothState.get(toothNo);
  return state?.customStates?.[pluginId];
}

/**
 * Enable or disable read-only mode. When read-only, all click, touch, and
 * keyboard interactions are disabled. The control panel is dimmed and
 * non-interactive. Useful for print/report views.
 *
 * @param value - `true` to enable read-only mode, `false` to disable.
 */
export function setReadOnly(value: boolean){
  setReadOnlyState(value);
  const grid = $("#toothGrid") as HTMLElement | null;
  if(grid) grid.classList.toggle("read-only", readOnly);
  const panel = $(".panel") as HTMLElement | null;
  if(panel) panel.classList.toggle("read-only", readOnly);
  // The perio chart's grid disabled state is baked in at open/resync, so extend
  // the same live `.read-only` lock to whichever perio
  // container is currently mounted: `#perioOverlay` (popup chrome) or
  // `#perioInlinePanel` (inline "Dental Chart" housing). Both are queried
  // defensively (only one is ever mounted at a time, and neither may be
  // mounted at all) — mirrors the `panel`/`grid` null-safety above.
  const perioOverlay = $("#perioOverlay") as HTMLElement | null;
  if(perioOverlay) perioOverlay.classList.toggle("read-only", readOnly);
  const perioInline = $("#perioInlinePanel") as HTMLElement | null;
  if(perioInline) perioInline.classList.toggle("read-only", readOnly);
  // Update tabindex on all navigable tiles
  $$(".tooth-tile[role='option']").forEach(tile => {
    tile.setAttribute("tabindex", readOnly ? "-1" : "0");
  });
}


/**
 * Enable or disable per-tooth notes.
 */
export function setNotesEnabled(value: boolean){
  const next = !!value;
  if(next === notesEnabled) return;
  setNotesEnabledRaw(next);
  for(const toothNo of ALL_TEETH){
    updateToothTooltip(toothNo);
    updateToothLabelNoteIcon(toothNo);
  }
  notifyStateChange();
}

/**
 * Check if any tooth has a non-empty note.
 */
export function hasAnyToothNote(): boolean {
  if(!notesEnabled) return false;
  for(const s of toothState.values()){
    if(s.note && s.note.trim() !== "") return true;
  }
  return false;
}

export { setOcclusalVisible, setWisdomVisible, setShowBase, setHealthyPulpVisible };


// Wire delegate hooks for engine modules
setApplyToSelectedHandler(applyToSelected);
setClearSelectionHandler(updateSelectionUI);
setRevertControlsHandler(revertActiveControls);
setExportViewToggleHandlers(setShowBase, setHealthyPulpVisible);
setEdentulousResetter(() => setEdentulous(false));
setResetToothHandler(() => {
  if (selectedTeeth.size > 0) resetTeethGated(Array.from(selectedTeeth) as number[]);
});
setPlanRepaintHook(() => {
  for (const toothNo of ALL_TEETH) {
    applyStateToSvg(toothNo);
    updateToothTileNumber(toothNo);
    updateToothLabelNoteIcon(toothNo);
  }
});
setSessionControlsSyncHook(() => {
  if (activeTooth) syncControlsFromState(toothState.get(activeTooth));
});
setSessionTooltipSyncHook(() => {
  for (const toothNo of ALL_TEETH) updateToothTooltip(toothNo);
});
