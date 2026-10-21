import { notifyStateChange } from "@/state/notify";
import { VALID_CARD_IDS, FILLING_MATERIALS } from "@/engine/constants";
import type {
  ToothDetailLevel,
  SurfaceNotation,
  SecondaryCariesMode,
  RootCariesMode,
  RadiographicDepthMode,
  PerioViewMode,
  PerioOverlayLayer,
} from "@/engine/types";

// Hooks for engine-level UI/control synchronization
type SessionControlsSync = () => void;
type SessionTooltipSync = () => void;

let controlsSyncHook: SessionControlsSync | null = null;
let tooltipSyncHook: SessionTooltipSync | null = null;

export function setSessionControlsSyncHook(hook: SessionControlsSync | null): void {
  controlsSyncHook = hook;
}

export function setSessionTooltipSyncHook(hook: SessionTooltipSync | null): void {
  tooltipSyncHook = hook;
}

// ---- Card collapse state ----
export let collapsedCards: Record<string, boolean> = {};

export function setCollapsedCards(val: Record<string, boolean>): void {
  collapsedCards = { ...val };
}

export function getCollapsedCards(): Record<string, boolean> {
  return { ...collapsedCards };
}

export function isCardCollapsed(id: string): boolean {
  return VALID_CARD_IDS.has(id) ? !!collapsedCards[id] : false;
}

export function setCollapsedCard(id: string, collapsed: boolean): void {
  if (!VALID_CARD_IDS.has(id)) return;
  collapsedCards[id] = !!collapsed;
  notifyStateChange();
}

export function toggleCollapsedCard(id: string): void {
  if (!VALID_CARD_IDS.has(id)) return;
  collapsedCards[id] = !collapsedCards[id];
  notifyStateChange();
}

export function resetCollapsedCards(): void {
  collapsedCards = {};
}

// ---- ICDAS setting ----
export let icdasEnabled = false;

export function setIcdasEnabled(value: boolean): void {
  const next = !!value;
  if (next === icdasEnabled) return;
  icdasEnabled = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getIcdasEnabled(): boolean {
  return icdasEnabled;
}

// ---- Wear / discoloration detail level ----
export let wearDetailLevel: ToothDetailLevel = "complex";

export function setWearDetailLevel(value: ToothDetailLevel): void {
  const next = value === "simple" ? "simple" : "complex";
  if (next === wearDetailLevel) return;
  wearDetailLevel = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getWearDetailLevel(): ToothDetailLevel {
  return wearDetailLevel;
}

export let discolorationDetailLevel: ToothDetailLevel = "complex";

export function setDiscolorationDetailLevel(value: ToothDetailLevel): void {
  const next = value === "simple" ? "simple" : "complex";
  if (next === discolorationDetailLevel) return;
  discolorationDetailLevel = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getDiscolorationDetailLevel(): ToothDetailLevel {
  return discolorationDetailLevel;
}

// ---- Surface notation ----
export let surfaceNotation: SurfaceNotation = "full";

export function setSurfaceNotation(value: SurfaceNotation): void {
  const next = value === "simple" ? "simple" : "full";
  if (next === surfaceNotation) return;
  surfaceNotation = next;
  controlsSyncHook?.();
  notifyStateChange();
  tooltipSyncHook?.();
}

export function getSurfaceNotation(): SurfaceNotation {
  return surfaceNotation;
}

// ---- Caries granularity settings ----
export let secondaryCariesMode: SecondaryCariesMode = "standard";

export function setSecondaryCariesMode(value: SecondaryCariesMode): void {
  const next = value === "simple" || value === "full" ? value : "standard";
  if (next === secondaryCariesMode) return;
  secondaryCariesMode = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getSecondaryCariesMode(): SecondaryCariesMode {
  return secondaryCariesMode;
}

export let rootCariesMode: RootCariesMode = "simple";

export function setRootCariesMode(value: RootCariesMode): void {
  const next = value === "severity" ? "severity" : "simple";
  if (next === rootCariesMode) return;
  rootCariesMode = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getRootCariesMode(): RootCariesMode {
  return rootCariesMode;
}

export let radiographicDepthMode: RadiographicDepthMode = "off";

export function setRadiographicDepthMode(value: RadiographicDepthMode): void {
  const next = value === "threeLevel" || value === "detailed" ? value : "off";
  if (next === radiographicDepthMode) return;
  radiographicDepthMode = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getRadiographicDepthMode(): RadiographicDepthMode {
  return radiographicDepthMode;
}

export let cariesDepthEnabled = true;

export function setCariesDepthEnabled(value: boolean): void {
  const next = value !== false;
  if (next === cariesDepthEnabled) return;
  cariesDepthEnabled = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getCariesDepthEnabled(): boolean {
  return cariesDepthEnabled;
}

// ---- Fillings configuration ----
export let fillingDefectEnabled = true;
export let fillingComplexity: "complex" | "simple" = "complex";
export let fissureSealingEnabled = true;
export const fillingMaterialAvail: Record<string, boolean> = {
  amalgam: true,
  composite: true,
  gic: true,
  temporary: true,
};

export function getFillingDefectEnabled(): boolean {
  return fillingDefectEnabled;
}

export function setFillingDefectEnabled(v: boolean): void {
  const next = !!v;
  if (next === fillingDefectEnabled) return;
  fillingDefectEnabled = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getFillingComplexity(): "complex" | "simple" {
  return fillingComplexity;
}

export function setFillingComplexity(v: "complex" | "simple"): void {
  const next = v === "simple" ? "simple" : "complex";
  if (next === fillingComplexity) return;
  fillingComplexity = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getFissureSealingEnabled(): boolean {
  return fissureSealingEnabled;
}

export function setFissureSealingEnabled(v: boolean): void {
  const next = !!v;
  if (next === fissureSealingEnabled) return;
  fissureSealingEnabled = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function getFillingMaterialAvailability(): Record<string, boolean> {
  return { ...fillingMaterialAvail };
}

export function setFillingMaterialAvailability(material: string, v: boolean): void {
  if (!Object.prototype.hasOwnProperty.call(fillingMaterialAvail, material)) return;
  const next = !!v;
  if (fillingMaterialAvail[material] === next) return;
  fillingMaterialAvail[material] = next;
  controlsSyncHook?.();
  notifyStateChange();
}

export function availableFillingMaterials(): readonly string[] {
  return FILLING_MATERIALS.filter((m) => fillingMaterialAvail[m]);
}

// ---- Perio view mode ----
export let perioViewMode: PerioViewMode = "toggle";

export function getPerioViewMode(): PerioViewMode {
  return perioViewMode;
}

export function setPerioViewMode(mode: PerioViewMode): void {
  if (mode === perioViewMode) return;
  perioViewMode = mode;
  notifyStateChange();
}

// ---- Diagnosis coding pack ----
export let diagnosisCodingPack = "none";

export function getDiagnosisCodingPack(): string {
  return diagnosisCodingPack;
}

export function setDiagnosisCodingPack(id: string): void {
  if (id === diagnosisCodingPack) return;
  diagnosisCodingPack = id;
  notifyStateChange();
}

// ---- SNOMED CT overlay flag ----
export let snomedEnabled = false;

export function getSnomedEnabled(): boolean {
  return snomedEnabled;
}

export function setSnomedEnabled(v: boolean): void {
  if (v === snomedEnabled) return;
  snomedEnabled = v;
  notifyStateChange();
}

// ---- Dental Chart overlay layer ----
export let perioOverlayLayer: PerioOverlayLayer = "none";

export function getPerioOverlayLayer(): PerioOverlayLayer {
  return perioOverlayLayer;
}

export function setPerioOverlayLayer(layer: PerioOverlayLayer): void {
  if (layer === perioOverlayLayer) return;
  perioOverlayLayer = layer;
  notifyStateChange();
}

// ---- Per-tooth notes ----
export let notesEnabled = false;

export function getNotesEnabled(): boolean {
  return notesEnabled;
}

export function setNotesEnabledRaw(value: boolean): void {
  notesEnabled = value;
}

