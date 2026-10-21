import { t } from "@/i18n/useI18n";
import { furcationEntrances, isPerioRowHidden, type PerioSite } from "@/odontogram";
import { mkEl } from "./popover";
import { PLAQUE_SURFACES, SURFACE_LETTER } from "./constants";
import type { ToothCellRefs, GridHandlers } from "./types";

export function mesialOnLeft(toothNo: number): boolean {
  const quadrant = Math.floor(toothNo / 10);
  return quadrant === 2 || quadrant === 3;
}

export function diamondGridArea(surface: string, toothNo: number): "buc" | "mes" | "dis" | "lin" {
  if (surface === "buccal") return "buc";
  if (surface === "lingual") return "lin";
  const onLeft = mesialOnLeft(toothNo);
  if (surface === "mesial") return onLeft ? "mes" : "dis";
  return onLeft ? "dis" : "mes";
}

export function buildFieldCell(
  toothNo: number,
  field: "pd" | "gm" | "cal" | "bop",
  sites: readonly PerioSite[],
  aspect: "buccal" | "palatal",
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell");
  cell.dataset.perioAspect = aspect;
  cell.dataset.perioField = field;
  const group = mkEl("div", "perio-fullgrid-sitegroup");
  for (const site of sites) {
    if (field === "cal") {
      const span = mkEl("span", "perio-fullgrid-cal");
      span.id = `perio-fg-cal-${toothNo}-${site}`;
      group.appendChild(span);
      cells.cal[site] = span;
    } else if (field === "bop") {
      const input = mkEl("input", "perio-fullgrid-bop");
      input.type = "checkbox";
      input.id = `perio-fg-bop-${toothNo}-${site}`;
      input.title = t(`perio.site.${site}`);
      input.dataset.perio = `${toothNo}:${site}:bop`;
      input.addEventListener("change", () => handlers.onBop(toothNo, site, input.checked));
      group.appendChild(input);
      cells.bop[site] = input;
    } else if (field === "pd") {
      const input = mkEl("input", "perio-fullgrid-input");
      input.type = "number";
      input.min = "1";
      input.max = "15";
      input.step = "1";
      input.id = `perio-fg-pd-${toothNo}-${site}`;
      input.title = t(`perio.site.${site}`);
      input.dataset.perio = `${toothNo}:${site}:pd`;
      input.addEventListener("change", () => handlers.onPd(toothNo, site, input.value));
      group.appendChild(input);
      cells.pd[site] = input;
    } else {
      const input = mkEl("input", "perio-fullgrid-input");
      input.type = "number";
      input.min = "-10";
      input.max = "20";
      input.step = "1";
      input.id = `perio-fg-gm-${toothNo}-${site}`;
      input.title = t(`perio.site.${site}`);
      input.dataset.perio = `${toothNo}:${site}:gm`;
      input.addEventListener("change", () => handlers.onGm(toothNo, site, input.value));
      group.appendChild(input);
      cells.gm[site] = input;
    }
  }
  cell.appendChild(group);
  return cell;
}

export function buildFurcationCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-furcation");
  cell.dataset.perioField = "furcation";
  const entrances = furcationEntrances(toothNo);
  if (entrances.length === 0 || isPerioRowHidden(toothNo)) return cell;
  const group = mkEl("div", "perio-fullgrid-sitegroup");
  for (const entrance of entrances) {
    const btn = mkEl("button", "perio-fullgrid-furc");
    btn.type = "button";
    btn.id = `perio-fg-furc-${toothNo}-${entrance}`;
    btn.dataset.furcEntrance = entrance;
    btn.title = t(`furcation.entrance.${entrance}`);
    btn.setAttribute("aria-label", t(`furcation.entrance.${entrance}`));
    btn.addEventListener("click", () => handlers.onFurcation(toothNo, entrance));
    group.appendChild(btn);
    cells.furcation[entrance] = btn;
  }
  cell.appendChild(group);
  return cell;
}

export function buildPlaqueCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-plaque");
  cell.dataset.perioField = "plaque";
  const group = mkEl("div", "perio-fullgrid-plaque-quad");
  for (const surface of PLAQUE_SURFACES) {
    const btn = mkEl("button", `perio-fullgrid-plaque perio-fullgrid-plaque-${surface}`);
    btn.type = "button";
    btn.id = `perio-fg-plaque-${toothNo}-${surface}`;
    btn.dataset.plaqueSurface = surface;
    btn.dataset.surfaceLetter = SURFACE_LETTER[surface] ?? "";
    btn.style.gridArea = diamondGridArea(surface, toothNo);
    btn.title = t(`surface.${surface}`);
    btn.setAttribute("aria-label", t(`surface.${surface}`));
    btn.addEventListener("click", () => handlers.onPlaque(toothNo, surface));
    group.appendChild(btn);
    cells.plaque[surface] = btn;
  }
  cell.appendChild(group);
  return cell;
}

export function buildCejVisibilityCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-cej");
  cell.dataset.perioField = "cejVisibility";
  const btn = mkEl("button", "perio-fullgrid-cej") as HTMLButtonElement;
  btn.type = "button";
  btn.id = `perio-fg-cej-${toothNo}`;
  btn.title = t("perio.cej.label");
  btn.setAttribute("aria-label", t("perio.cej.label"));
  btn.addEventListener("click", () => handlers.onCejVisibility(toothNo));
  cell.appendChild(btn);
  cells.cejVisibility = btn;
  return cell;
}

export function buildRootConcavityCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-rootconcavity");
  cell.dataset.perioField = "rootConcavity";
  const btn = mkEl("button", "perio-fullgrid-rootconcavity") as HTMLButtonElement;
  btn.type = "button";
  btn.id = `perio-fg-rootconcavity-${toothNo}`;
  btn.title = t("perio.rootConcavity.label");
  btn.setAttribute("aria-label", t("perio.rootConcavity.label"));
  btn.addEventListener("click", () => handlers.onRootConcavity(toothNo));
  cell.appendChild(btn);
  cells.rootConcavity = btn;
  return cell;
}

export function buildGradeCell(
  toothNo: number,
  mapKey: "pi" | "gi" | "mpi" | "mbi",
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", `perio-fullgrid-cell perio-fullgrid-cell-${mapKey}`);
  cell.dataset.perioField = mapKey;
  const group = mkEl("div", "perio-fullgrid-plaque-quad");
  const onSurface =
    mapKey === "pi" ? handlers.onPiSurface :
    mapKey === "gi" ? handlers.onGiSurface :
    mapKey === "mpi" ? handlers.onMpiSurface :
    handlers.onMbiSurface;
  const registry =
    mapKey === "pi" ? cells.pi :
    mapKey === "gi" ? cells.gi :
    mapKey === "mpi" ? cells.mpi :
    cells.mbi;
  for (const surface of PLAQUE_SURFACES) {
    const btn = mkEl("button", `perio-fullgrid-${mapKey} perio-fullgrid-${mapKey}-${surface}`);
    btn.type = "button";
    btn.id = `perio-fg-${mapKey}-${toothNo}-${surface}`;
    btn.dataset.gradeSurface = surface;
    btn.dataset.surfaceLetter = SURFACE_LETTER[surface] ?? "";
    btn.style.gridArea = diamondGridArea(surface, toothNo);
    btn.title = t(`surface.${surface}`);
    btn.setAttribute("aria-label", t(`surface.${surface}`));
    btn.addEventListener("click", () => onSurface(toothNo, surface));
    group.appendChild(btn);
    registry[surface] = btn;
  }
  cell.appendChild(group);
  return cell;
}

export function buildKgCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-kg");
  cell.dataset.perioField = "kg";
  const input = mkEl("input", "perio-fullgrid-input perio-fullgrid-kg") as HTMLInputElement;
  input.type = "number";
  input.min = "0";
  input.max = "15";
  input.step = "1";
  input.id = `perio-fg-kg-${toothNo}`;
  input.title = t("perio.kg.row");
  input.addEventListener("change", () => handlers.onKg(toothNo, input.value));
  cell.appendChild(input);
  cells.kg = input;
  return cell;
}

export function buildGingivalThicknessCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-gt");
  cell.dataset.perioField = "gingivalThickness";
  const btn = mkEl("button", "perio-fullgrid-gt") as HTMLButtonElement;
  btn.type = "button";
  btn.id = `perio-fg-gt-${toothNo}`;
  btn.title = t("perio.gt.row");
  btn.setAttribute("aria-label", t("perio.gt.row"));
  btn.addEventListener("click", () => handlers.onGingivalThickness(toothNo));
  cell.appendChild(btn);
  cells.gingivalThickness = btn;
  return cell;
}

export function buildMillerClassCell(
  toothNo: number,
  cells: ToothCellRefs,
  handlers: GridHandlers,
): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-cell perio-fullgrid-cell-miller");
  cell.dataset.perioField = "millerClass";
  const btn = mkEl("button", "perio-fullgrid-miller") as HTMLButtonElement;
  btn.type = "button";
  btn.id = `perio-fg-miller-${toothNo}`;
  btn.title = t("perio.miller.row");
  btn.setAttribute("aria-label", t("perio.miller.row"));
  btn.addEventListener("click", () => handlers.onMillerClass(toothNo));
  cell.appendChild(btn);
  cells.millerClass = btn;
  return cell;
}
