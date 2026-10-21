import { t } from "@/i18n/useI18n";
import { optionsFor } from "@/registry/uiOptions";
import {
  isUpperTooth,
  formatToothLabel,
  isToothImplant,
  getPerioToothKind,
  getPerioRowVisibility,
  type PerioSite,
} from "@/odontogram";
import { indexName } from "@/perioIndexNames";
import {
  archToothLayout,
  TOOTH_GAP,
  computeFillScale,
  type TemplateDocCache,
} from "@/perioGraphic";
import {
  ROW_LABEL_WIDTH,
  PROVISIONAL_COL_WIDTH,
  GRID_SCROLLBAR_ALLOWANCE,
  BUCCAL_SITES,
  LINGUAL_SITES,
} from "./constants";
import { mkEl, mkRowLabelCell } from "./popover";
import {
  buildFieldCell,
  buildFurcationCell,
  buildPlaqueCell,
  buildCejVisibilityCell,
  buildRootConcavityCell,
  buildGradeCell,
  buildKgCell,
  buildGingivalThicknessCell,
  buildMillerClassCell,
} from "./cellBuilders";
import type { BuiltArch, ToothCellRefs, GridHandlers } from "./types";

/**
 * Build ONE arch band, laid out buccal-graphic-top → central perio index
 * band → palatal-graphic-bottom.
 */
export function buildArch(
  teeth: readonly number[],
  registry: Map<number, ToothCellRefs>,
  handlers: GridHandlers,
): BuiltArch {
  const arch = mkEl("div", "perio-fullgrid-arch");
  arch.style.gridTemplateColumns = `${ROW_LABEL_WIDTH}px repeat(${teeth.length}, ${PROVISIONAL_COL_WIDTH}px)`;
  const isUpper = teeth.length > 0 && isUpperTooth(teeth[0]);
  const visible = getPerioRowVisibility();
  const archHasImplant = teeth.some((n) => isToothImplant(n));

  for (const toothNo of teeth) {
    registry.set(toothNo, {
      pd: {}, gm: {}, bop: {}, cal: {}, mobility: null, furcation: {}, plaque: {},
      cejVisibility: null, rootConcavity: null,
      pi: {}, gi: {}, kg: null, gingivalThickness: null, millerClass: null,
      mpi: {}, mbi: {},
    });
  }

  const buccalLabel = t("perio.buccal");
  const lingualLabel = isUpper ? t("perio.palatal") : t("perio.lingual");

  const appendFieldRow = (
    field: "pd" | "gm" | "cal" | "bop",
    sites: readonly PerioSite[],
    aspect: "buccal" | "palatal",
    label: string,
  ) => {
    arch.appendChild(mkRowLabelCell(label, `perio.info.${field}`));
    for (const toothNo of teeth) {
      arch.appendChild(buildFieldCell(toothNo, field, sites, aspect, registry.get(toothNo)!, handlers));
    }
  };

  // --- Tooth-number header row ---
  arch.appendChild(mkRowLabelCell(""));
  for (const toothNo of teeth) {
    const header = mkEl("div", "perio-fullgrid-header-cell");
    header.setAttribute("data-perio-tooth-header", String(toothNo));
    header.textContent = formatToothLabel(toothNo);
    arch.appendChild(header);
  }

  // --- Miller-class row ---
  if (visible.miller) {
    arch.appendChild(mkRowLabelCell(indexName("miller"), "perio.info.miller"));
    for (const toothNo of teeth) {
      arch.appendChild(buildMillerClassCell(toothNo, registry.get(toothNo)!, handlers));
    }
  }

  // --- Buccal-aspect rows, ABOVE the graphic ---
  if (visible.bop) appendFieldRow("bop", BUCCAL_SITES, "buccal", `${buccalLabel} ${indexName("bop")}`);
  if (visible.cal) appendFieldRow("cal", BUCCAL_SITES, "buccal", `${buccalLabel} ${indexName("cal")}`);
  if (visible.gm) appendFieldRow("gm", BUCCAL_SITES, "buccal", `${buccalLabel} ${indexName("gm")}`);
  if (visible.pd) appendFieldRow("pd", BUCCAL_SITES, "buccal", `${buccalLabel} ${indexName("pd")}`);

  // --- Furcation row ---
  if (visible.furcation) {
    arch.appendChild(mkRowLabelCell(indexName("furcation"), "perio.info.furcation"));
    for (const toothNo of teeth) {
      arch.appendChild(buildFurcationCell(toothNo, registry.get(toothNo)!, handlers));
    }
  }

  // --- BUCCAL tooth-row graphic cell ---
  arch.appendChild(mkRowLabelCell(""));
  const buccalCell = mkEl("div", "perio-fullgrid-graphic-cell");
  buccalCell.dataset.perioArch = isUpper ? "upper" : "lower";
  buccalCell.dataset.perioAspect = "buccal";
  buccalCell.style.gridColumn = "2 / -1";
  arch.appendChild(buccalCell);

  // --- Band-orientation legend (top) ---
  arch.appendChild(mkRowLabelCell(""));
  const bandLabelTop = mkEl("div", "perio-fullgrid-band-label");
  bandLabelTop.style.gridColumn = "2 / -1";
  bandLabelTop.setAttribute("role", "note");
  bandLabelTop.setAttribute("aria-label", t("perio.band.title"));
  const bandBuccal = mkEl("span", "perio-fullgrid-band-label-buccal");
  bandBuccal.textContent = `▲ ${t("perio.band.buccal")} ▲`;
  bandLabelTop.appendChild(bandBuccal);
  arch.appendChild(bandLabelTop);

  // --- Central perio index band ---
  if (visible.plaque) {
    arch.appendChild(mkRowLabelCell(indexName("plaque"), "perio.info.plaque"));
    for (const toothNo of teeth) {
      arch.appendChild(buildPlaqueCell(toothNo, registry.get(toothNo)!, handlers));
    }
  }
  if (visible.pi) {
    arch.appendChild(mkRowLabelCell(indexName("pi"), "perio.info.pi"));
    for (const toothNo of teeth) {
      arch.appendChild(buildGradeCell(toothNo, "pi", registry.get(toothNo)!, handlers));
    }
  }
  if (visible.gi) {
    arch.appendChild(mkRowLabelCell(indexName("gi"), "perio.info.gi"));
    for (const toothNo of teeth) {
      arch.appendChild(buildGradeCell(toothNo, "gi", registry.get(toothNo)!, handlers));
    }
  }
  if (visible.mpi && archHasImplant) {
    arch.appendChild(mkRowLabelCell(indexName("mpi"), "perio.info.mpi"));
    for (const toothNo of teeth) {
      arch.appendChild(buildGradeCell(toothNo, "mpi", registry.get(toothNo)!, handlers));
    }
  }
  if (visible.mbi && archHasImplant) {
    arch.appendChild(mkRowLabelCell(indexName("mbi"), "perio.info.mbi"));
    for (const toothNo of teeth) {
      arch.appendChild(buildGradeCell(toothNo, "mbi", registry.get(toothNo)!, handlers));
    }
  }

  // --- Band-orientation legend (bottom) ---
  arch.appendChild(mkRowLabelCell(""));
  const bandLabelBottom = mkEl("div", "perio-fullgrid-band-label");
  bandLabelBottom.style.gridColumn = "2 / -1";
  bandLabelBottom.setAttribute("role", "note");
  bandLabelBottom.setAttribute("aria-label", t("perio.band.title"));
  const bandLingual = mkEl("span", "perio-fullgrid-band-label-lingual");
  bandLingual.textContent = `▼ ${t("perio.band.lingual")} ▼`;
  bandLabelBottom.appendChild(bandLingual);
  arch.appendChild(bandLabelBottom);

  // --- PALATAL tooth-row graphic cell ---
  arch.appendChild(mkRowLabelCell(""));
  const palatalCell = mkEl("div", "perio-fullgrid-graphic-cell");
  palatalCell.dataset.perioArch = isUpper ? "upper" : "lower";
  palatalCell.dataset.perioAspect = "palatal";
  palatalCell.style.gridColumn = "2 / -1";
  arch.appendChild(palatalCell);

  // --- Palatal-aspect rows, BELOW the graphic ---
  if (visible.pd) appendFieldRow("pd", LINGUAL_SITES, "palatal", `${lingualLabel} ${indexName("pd")}`);
  if (visible.gm) appendFieldRow("gm", LINGUAL_SITES, "palatal", `${lingualLabel} ${indexName("gm")}`);
  if (visible.cal) appendFieldRow("cal", LINGUAL_SITES, "palatal", `${lingualLabel} ${indexName("cal")}`);
  if (visible.bop) appendFieldRow("bop", LINGUAL_SITES, "palatal", `${lingualLabel} ${indexName("bop")}`);

  // --- Mobility row ---
  if (visible.mobility) {
    arch.appendChild(mkRowLabelCell(indexName("mobility"), "perio.info.mobility"));
    const mobilityOptions = optionsFor("mobility").map((o) => ({ value: o.value, label: t(o.labelKey) }));
    for (const toothNo of teeth) {
      const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-mobility");
      const select = mkEl("select", "perio-fullgrid-mobility-select");
      select.id = `perio-fg-mobility-${toothNo}`;
      for (const opt of mobilityOptions) {
        const optionEl = mkEl("option");
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        select.appendChild(optionEl);
      }
      select.addEventListener("change", () => handlers.onMobility(toothNo, select.value));
      cell.appendChild(select);
      arch.appendChild(cell);
      registry.get(toothNo)!.mobility = select;
    }
  }

  // --- CEJ-visibility row ---
  if (visible.cej) {
    arch.appendChild(mkRowLabelCell(indexName("cej"), "perio.info.cej"));
    for (const toothNo of teeth) {
      arch.appendChild(buildCejVisibilityCell(toothNo, registry.get(toothNo)!, handlers));
    }
  }

  // --- Root-concavity row ---
  if (visible.rootConcavity) {
    arch.appendChild(mkRowLabelCell(indexName("rootConcavity"), "perio.info.rootConcavity"));
    for (const toothNo of teeth) {
      arch.appendChild(buildRootConcavityCell(toothNo, registry.get(toothNo)!, handlers));
    }
  }

  // --- KG row ---
  if (visible.kg) {
    arch.appendChild(mkRowLabelCell(indexName("kg"), "perio.info.kg"));
    for (const toothNo of teeth) {
      arch.appendChild(buildKgCell(toothNo, registry.get(toothNo)!, handlers));
    }
  }

  // --- GT row ---
  if (visible.gt) {
    arch.appendChild(mkRowLabelCell(indexName("gt"), "perio.info.gt"));
    for (const toothNo of teeth) {
      arch.appendChild(buildGingivalThicknessCell(toothNo, registry.get(toothNo)!, handlers));
    }
  }

  return { grid: arch, buccalCell, palatalCell };
}

/** Widen an already-built arch grid's tooth columns to the real per-tooth
 *  arch-layout widths, scaled to fill the available width of `scrollContainer`. */
export function applyArchColumns(
  grid: HTMLElement | null,
  teeth: readonly number[],
  cache: TemplateDocCache,
  scrollContainer: HTMLElement | null,
): void {
  if (!grid) return;
  const layout = archToothLayout(cache, teeth, undefined, getPerioToothKind);
  if (layout.teeth.length === 0) return;
  const containerWidth = scrollContainer?.clientWidth ?? 0;
  const available = containerWidth - ROW_LABEL_WIDTH - GRID_SCROLLBAR_ALLOWANCE;
  const fillScale = computeFillScale(available, layout.totalWidth);
  const cols = layout.teeth
    .map((tooth) => `${((tooth.width + TOOTH_GAP) * fillScale).toFixed(3)}px`)
    .join(" ");
  grid.style.gridTemplateColumns = `${ROW_LABEL_WIDTH}px ${cols}`;
}
