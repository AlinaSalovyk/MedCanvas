import type { ReactNode } from "react";
import type {
  OdontogramSummary,
  PulpDetailLevel,
  SecondaryCariesMode,
  RootCariesMode,
  RadiographicDepthMode,
  ToothDetailLevel,
  SurfaceNotation,
  PerioViewMode,
  ToothAnatomy,
} from "@/odontogram";
import type { useI18n } from "@/i18n/useI18n";
import type { SettingsState, ScreenToothSpacing, ScreenToothNumberSize, SelectionBorderStyle, FillingComplexity } from "@/SettingsModal";
import type { Language } from "@/i18n/languages";
import type { NumberingSystem } from "@/utils/numbering";
import type { OdontogramThemeConfig } from "@/theme";
import type { OdontogramPlugin } from "@/plugin";

/**
 * Props for {@link OdontogramProvider} — the full former `OdontogramShell`
 * (`App`) props surface plus the composed `children`. All state/behavior props
 * are optional: when omitted the provider operates in **standalone** mode with
 * internal state; when provided it operates in **controlled** mode and delegates
 * state to the parent.
 */
export type OdontogramProviderProps = {
  /** Override the UI language (controlled mode). */
  language?: Language;
  /** Callback when the user changes the language. */
  onLanguageChange?: (lang: Language) => void;
  /** Override the tooth numbering system (controlled mode). */
  numberingSystem?: NumberingSystem;
  /** Callback when the user changes the numbering system. */
  onNumberingChange?: (system: NumberingSystem) => void;
  /** Override dark mode state (controlled mode). */
  darkMode?: boolean;
  /** Callback when the user toggles dark mode. */
  onDarkModeChange?: (dark: boolean) => void;
  /**
   * Custom theme configuration. Overrides the default color palette via
   * CSS custom properties (`--odon-*`). See {@link OdontogramThemeConfig}.
   */
  themeConfig?: OdontogramThemeConfig;
  /**
   * Custom SVG plugins for extending the odontogram with additional visual
   * overlays and per-tooth custom state. See {@link OdontogramPlugin}.
   */
  plugins?: OdontogramPlugin[];
  /**
   * When true, disables all interactions (click, touch, keyboard).
   * Useful for print/report/view modes.
   */
  readOnly?: boolean;
  /**
   * When true, enables per-tooth notes. Double-click a tooth to add/edit a note.
   * Notes are shown in hover tooltips and included in JSON export/import.
   */
  enableNotes?: boolean;
  /**
   * Enable ICDAS II per-surface caries scoring (0–6). When enabled, the depth
   * selector/popup expose ICDAS codes 1–6 and the surface indicator shows a
   * numeric badge; otherwise the 3-level scale is used.
   */
  enableIcdas?: boolean;
  /**
   * Pulp-diagnosis detail level for the pulp control:
   * `"simple"` (healthy / pulpitis), `"aae"` (4 AAE pulp diagnoses, default) or
   * `"latin"` (9 practical-Latin subtypes). A stored value round-trips at every
   * level; the level only governs how the pulp control presents it.
   */
  pulpDetailLevel?: PulpDetailLevel;
  /**
   * Secondary-caries (CARS) granularity for the per-surface score picker:
   * `"simple"` ([0,3]), `"standard"` ([0,1,3,6], default) or `"full"` ([0..6]).
   * A stored score round-trips at every mode; the mode only governs the offered
   * option list. (The mode UI lives in the Settings modal; this prop is the
   * controlled entry point.)
   */
  secondaryCariesMode?: SecondaryCariesMode;
  /**
   * Root-caries granularity for the per-tooth picker: `"simple"` (none /
   * present, default) or `"severity"` (the full none/active/arrested/
   * active-cavitated enum). Non-collapsing across modes.
   */
  rootCariesMode?: RootCariesMode;
  /**
   * Radiographic-depth granularity for the per-surface picker: `"off"`
   * (hidden, default), `"threeLevel"` (superficial/middle/deep) or `"detailed"`
   * (E1..D3). When off, the per-surface radiographic badge is not shown.
   */
  radiographicDepthMode?: RadiographicDepthMode;
  /**
   * Whether the visual caries-depth encoding (per-surface depth picker + the
   * opacity/contour depth tier in the render) is active. Default `true`; set
   * `false` to render caried surfaces at the SVG default with no depth tier.
   */
  cariesDepthEnabled?: boolean;
  /**
   * Detail level for the per-tooth wear control: `"simple"` (yes/no toggle for
   * attrition) or `"complex"` (wear type per edge and cervix, default).
   */
  wearDetailLevel?: ToothDetailLevel;
  /**
   * Detail level for the per-tooth discoloration control: `"simple"` (yes/no
   * toggle) or `"complex"` (choose the discoloration cause, default).
   */
  discolorationDetailLevel?: ToothDetailLevel;
  /**
   * Surface-notation mode for caries/filling surface letters + captions:
   * `"full"` (default) makes them position-aware (incisal on an anterior
   * tooth, labial on an anterior buccal surface, palatal on an upper lingual
   * surface) or `"simple"` (always the tooth-independent B/O/L set).
   */
  surfaceNotation?: SurfaceNotation;
  /**
   * Whether the Statuses panel (`#statusCard`) is shown. Default `true`. The
   * panel visibility is a settings-driven wrapper around the section — the
   * section's own imperative collapse/expand behavior is unaffected.
   */
  showStatusCard?: boolean;
  /**
   * Whether the Orthodontics panel (`#orthoCard`) is shown. Default `true`.
   * Composes with the panel's own imperative ortho-eligibility gate (hidden
   * when no selected tooth is ortho-eligible) — both must be satisfied for
   * the panel to render.
   */
  showOrthoCard?: boolean;
  /**
   * Filling-complexity level for the Fillings card: `"simple"` (one material
   * per tooth, no per-surface picker) or `"complex"` (per-surface materials,
   * default). Contrast with `settings.panels` — this one mirrors the
   * `fillingComplexity` engine flag (Settings → Fillings). When provided, the
   * value overrides the engine/UI default; when omitted, whatever the engine
   * holds (module default or a prior `setFillingComplexity` call) stays put.
   */
  fillingComplexity?: FillingComplexity;
  /**
   * Called after the user changes the filling-complexity level in the
   * Settings modal: `(value: FillingComplexity) => void`. Not fired for
   * prop-driven restores. The write-back counterpart of {@link fillingComplexity}.
   */
  onFillingComplexityChange?: (value: FillingComplexity) => void;
  /**
   * Whether filling-defect findings are enabled on the Fillings card. Default
   * `true`. Mirrors the `fillingDefectEnabled` engine flag (Settings →
   * Fillings); same controlled/standalone contract as {@link fillingComplexity}.
   */
  fillingDefectEnabled?: boolean;
  /** See {@link onFillingComplexityChange} — the defect toggle's counterpart. */
  onFillingDefectEnabledChange?: (enabled: boolean) => void;
  /**
   * Available filling materials as a `Record<material, boolean>` over
   * `"amalgam" | "composite" | "gic" | "temporary"` (unknown keys are
   * ignored). Default: all four available. Mirrors the `fillingMaterialAvail`
   * engine map (Settings → Fillings). Hosts may pass an inline literal — the
   * sync effect keys on a canonical serialized form, so re-renders with
   * identical content do not re-fire.
   */
  fillingMaterialAvailability?: Record<string, boolean>;
  /**
   * Called after the user toggles a material in the Settings modal:
   * `(material: string, enabled: boolean) => void` — per-material, mirroring
   * the engine's `setFillingMaterialAvailability` setter (no whole-record
   * change ever happens). Not fired for prop-driven restores.
   */
  onFillingMaterialAvailabilityChange?: (material: string, enabled: boolean) => void;
  /**
   * Whether fissure-sealing is offered on the Fillings card. Default `true`.
   * Mirrors the `fissureSealingEnabled` engine flag (Settings → Fillings);
   * same controlled/standalone contract as {@link fillingComplexity}.
   */
  fissureSealingEnabled?: boolean;
  /** See {@link onFillingComplexityChange} — the fissure-sealing toggle's counterpart. */
  onFissureSealingEnabledChange?: (enabled: boolean) => void;
  /**
   * Inter-tooth spacing of the on-screen grid (Settings → Odontogram). Mirrors
   * the `screenToothSpacing` engine flag; same controlled/standalone contract
   * as {@link fillingComplexity}.
   */
  screenToothSpacing?: ScreenToothSpacing;
  /** Tooth-number size of the on-screen grid; same contract as {@link screenToothSpacing}. */
  screenToothNumberSize?: ScreenToothNumberSize;
  /** Selection-ring colour as `#rrggbb`; same contract as {@link screenToothSpacing}. */
  selectionColor?: string;
  /** Selection-ring border style; same contract as {@link screenToothSpacing}. */
  selectionBorderStyle?: SelectionBorderStyle;
  /** Whether the tooth-information panel is shown; same contract as {@link screenToothSpacing}. */
  toothInfo?: boolean;
  /** The composed UI (surfaces + shell layout). */
  children?: ReactNode;
};

/** The translate function surfaced by {@link useI18n}. */
export type TranslateFn = ReturnType<typeof useI18n>["t"];

/**
 * Everything the surface components and shell-managed modals consume. Cross-cutting
 * state read across ≥2 regions/modals lives here; strictly region-local state
 * (the header dropdown open flags + outside-click effect) stays inside its surface.
 */
export type OdontogramUiContextValue = {
  t: TranslateFn;
  lang: Language;
  setLang: (lang: Language) => void;
  isDark: boolean;
  toggleDark: () => void;
  currentNumbering: NumberingSystem;
  setNumbering: (next: NumberingSystem) => void;
  // Perio-view / layout flags.
  viewMode: PerioViewMode;
  activeView: "odontogram" | "dentalChart";
  setActiveView: (view: "odontogram" | "dentalChart") => void;
  isPerioView: boolean;
  perioChartAvailable: boolean;
  perioOpen: boolean;
  confirmOpen: boolean;
  // Export / import gates.
  hasPerio: boolean;
  exportPngOn: boolean;
  exportJpgOn: boolean;
  exportSvgOn: boolean;
  exportPdfOn: boolean;
  importStatusOn: boolean;
  importFhirOn: boolean;
  // Tooth-information panel.
  summary: OdontogramSummary | null;
  toothInfoOn: boolean;
  // Chart styling (shared between the chart surface and the Settings modal).
  screenSpacing: ScreenToothSpacing;
  screenNumberSize: ScreenToothNumberSize;
  selectionColor: string;
  selectionBorderStyle: SelectionBorderStyle;
  // Active tooth-anatomy profile (drives the chart surface's `data-anatomy`).
  toothAnatomy: ToothAnatomy;
  planModeAvailable: boolean;
  // Right-panel card gates.
  showStatusCard: boolean;
  showOrthoCard: boolean;
  // Modal plumbing.
  settingsState: SettingsState;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  pdfOpen: boolean;
  setPdfOpen: (open: boolean) => void;
  caseDxOpen: boolean;
  setCaseDxOpen: (open: boolean) => void;
};
