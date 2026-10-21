import {
  PERIO_SITES,
  isPerioRowHidden,
  getToothMobility,
  getToothFurcation,
  getToothPlaque,
  getCejVisibility,
  getRootConcavity,
  getPlaqueIndex,
  getGingivalIndex,
  isToothImplant,
  getPeriImplantPlaque,
  getPeriImplantBleeding,
  getKeratinizedWidth,
  getGingivalThickness,
  getMillerClass,
} from "@/odontogram";
import {
  FURCATION_ROMAN,
  CEJ_VISIBILITY_FACE,
  ROOT_CONCAVITY_FACE,
  GRADE_FACE,
  GINGIVAL_THICKNESS_FACE,
  MILLER_CLASS_FACE,
} from "./constants";
import type { ToothCellRefs, PerioSiteData } from "./types";

/** Sync ONE tooth's already-built cells from the given perio/CAL snapshot —
 *  the targeted-update primitive. Never creates/destroys DOM nodes, only
 *  updates value/checked/disabled/text on existing ones. */
export function syncToothCells(
  cells: ToothCellRefs,
  toothNo: number,
  perio: PerioSiteData,
  cal: Map<string, number>,
  readOnly: boolean,
): void {
  const hidden = isPerioRowHidden(toothNo);
  for (const site of PERIO_SITES) {
    const charted = Object.prototype.hasOwnProperty.call(perio.pd, site);
    const pdInput = cells.pd[site];
    if (pdInput) {
      pdInput.value = charted ? String(perio.pd[site]) : "";
      pdInput.disabled = readOnly || hidden;
    }
    const gmInput = cells.gm[site];
    if (gmInput) {
      gmInput.value = charted && Object.prototype.hasOwnProperty.call(perio.gm, site) ? String(perio.gm[site]) : "";
      gmInput.disabled = readOnly || hidden || !charted;
    }
    const bopInput = cells.bop[site];
    if (bopInput) {
      bopInput.checked = perio.bop.includes(site);
      bopInput.disabled = readOnly || hidden || !charted;
    }
    const calSpan = cells.cal[site];
    if (calSpan) {
      const calVal = cal.get(site);
      calSpan.textContent = calVal === undefined ? "" : String(calVal);
    }
  }
  if (cells.mobility) {
    cells.mobility.value = getToothMobility(toothNo);
    cells.mobility.disabled = readOnly || hidden;
  }

  const furc = getToothFurcation(toothNo);
  for (const entrance of Object.keys(cells.furcation)) {
    const btn = cells.furcation[entrance];
    if (!btn) continue;
    const grade = furc[entrance] ?? 0;
    btn.textContent = FURCATION_ROMAN[grade];
    btn.dataset.grade = String(grade);
    btn.setAttribute("aria-pressed", grade > 0 ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }

  const plaque = getToothPlaque(toothNo);
  for (const surface of Object.keys(cells.plaque)) {
    const btn = cells.plaque[surface];
    if (!btn) continue;
    const present = plaque.includes(surface);
    btn.dataset.present = present ? "1" : "0";
    btn.setAttribute("aria-pressed", present ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }

  if (cells.cejVisibility) {
    const value = getCejVisibility(toothNo);
    const btn = cells.cejVisibility;
    btn.textContent = CEJ_VISIBILITY_FACE[value] ?? "–";
    btn.dataset.value = value;
    btn.setAttribute("aria-pressed", value !== "none" ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }
  if (cells.rootConcavity) {
    const value = getRootConcavity(toothNo);
    const btn = cells.rootConcavity;
    btn.textContent = ROOT_CONCAVITY_FACE[value] ?? "–";
    btn.dataset.value = value;
    btn.setAttribute("aria-pressed", value !== "none" ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }

  for (const surface of Object.keys(cells.pi)) {
    const btn = cells.pi[surface];
    if (!btn) continue;
    const grade = getPlaqueIndex(toothNo, surface);
    btn.textContent = GRADE_FACE[grade] ?? "–";
    btn.dataset.grade = String(grade);
    btn.setAttribute("aria-pressed", grade > 0 ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }
  for (const surface of Object.keys(cells.gi)) {
    const btn = cells.gi[surface];
    if (!btn) continue;
    const grade = getGingivalIndex(toothNo, surface);
    btn.textContent = GRADE_FACE[grade] ?? "–";
    btn.dataset.grade = String(grade);
    btn.setAttribute("aria-pressed", grade > 0 ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }

  const implant = isToothImplant(toothNo);
  for (const surface of Object.keys(cells.mpi)) {
    const btn = cells.mpi[surface];
    if (!btn) continue;
    const grade = getPeriImplantPlaque(toothNo, surface);
    btn.textContent = GRADE_FACE[grade] ?? "–";
    btn.dataset.grade = String(grade);
    btn.setAttribute("aria-pressed", grade > 0 ? "true" : "false");
    btn.disabled = readOnly || !implant;
  }
  for (const surface of Object.keys(cells.mbi)) {
    const btn = cells.mbi[surface];
    if (!btn) continue;
    const grade = getPeriImplantBleeding(toothNo, surface);
    btn.textContent = GRADE_FACE[grade] ?? "–";
    btn.dataset.grade = String(grade);
    btn.setAttribute("aria-pressed", grade > 0 ? "true" : "false");
    btn.disabled = readOnly || !implant;
  }

  if (cells.kg) {
    const mm = getKeratinizedWidth(toothNo);
    cells.kg.value = mm === null ? "" : String(mm);
    cells.kg.disabled = readOnly || hidden;
  }

  if (cells.gingivalThickness) {
    const value = getGingivalThickness(toothNo);
    const btn = cells.gingivalThickness;
    btn.textContent = GINGIVAL_THICKNESS_FACE[value] ?? "–";
    btn.dataset.value = value;
    btn.setAttribute("aria-pressed", value !== "unknown" ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }
  if (cells.millerClass) {
    const value = getMillerClass(toothNo);
    const btn = cells.millerClass;
    btn.textContent = MILLER_CLASS_FACE[value] ?? "–";
    btn.dataset.value = value;
    btn.setAttribute("aria-pressed", value !== "none" ? "true" : "false");
    btn.disabled = readOnly || hidden;
  }
}
