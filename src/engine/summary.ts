import { toothState } from "@/state/chart";
import { t, getI18nLanguage } from "@/i18n/useI18n";
import { formatToothLabel } from "@/state/numbering";
import { ALL_TEETH } from "@/anatomy/profiles";
import {
  caseMeta,
  caseMetaIsEmpty,
  caseContextSummaryFragment,
  caseDiagnosesSummaryFragment,
} from "@/state/caseMeta";
import {
  getPerioClassification,
  classificationSummaryFragment,
  getToothRecessionType,
} from "@/state/perio";
import {
  kebabToCamel,
  wearRowAllowed,
  discolorationAllowed,
  orthoAllowed,
} from "@/state/pulpApical";
import { getPdfSettings } from "@/engine/pdfSettings";
import { getPlanChanges } from "@/engine/examCompare";
import { getRegisteredPlugins } from "@/engine/pluginRegistry";
import { getNotesEnabled } from "@/engine/sessionSettings";
import { getToothDiagnoses } from "@/engine/diagnoses";
import {
  SUMMARY_SURFACE_ORDER,
  SUMMARY_ENDO_KEY,
  SUMMARY_ROOT_CARIES_KEY,
  PROSTHESIS_SUMMARY_KEY,
} from "@/engine/constants";
import { summarySurfaceLetter } from "@/engine/surfaceHelpers";
import {
  restorationSummaryLabel,
  restorationRowHidden,
} from "@/engine/clinicalOptions";
import {
  cariesSeverityTierLabel,
  fractureSummaryLabel,
  diagnosisSummaryLabels,
  periImplantSummaryLabel,
  cejVisibilitySummaryLabel,
  rootConcavitySummaryLabel,
  plaqueIndexSummaryLine,
  gingivalIndexSummaryLine,
  keratinizedWidthSummaryLine,
  gingivalThicknessSummaryLabel,
  millerClassSummaryLabel,
  periImplantPlaqueSummaryLine,
  periImplantBleedingSummaryLine,
} from "@/engine/clinicalSummary";
import type {
  ToothTableStatus,
  ToothTableCell,
  OdontogramToothTable,
  OdontogramSummarySection,
  OdontogramSummary,
  PdfSummaryGrouping,
} from "@/engine/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

/**
 * Generate human-readable summary strings of all active findings on a tooth.
 */
export function getStateSummary(toothNo: number): string[] {
  const state = toothState.get(toothNo);
  if(!state) return [];
  const summary: string[] = [];

  // Tooth base
  if(state.toothSelection === "none") summary.push(t("toothSelect.none"));
  else if(state.toothSelection === "milktooth") summary.push(t("toothSelect.milk"));
  else if(state.toothSelection === "implant") summary.push(t("toothSelect.implant"));
  else if(state.toothSelection === "tooth-under-gum") summary.push(t("toothSelect.underGum"));

  // Tooth substrate (radix / broken / crown-prep) — independent of any restoration.
  if(state.toothSubstrate !== "natural"){
    summary.push(t(`substrate.${state.toothSubstrate}`));
  }

  // Fixed restoration (crown / inlay / onlay / veneer / bridge)
  if(state.restorationType !== "none"){
    summary.push(restorationSummaryLabel(state.restorationType, state.restorationMaterial));
  }

  // Prosthesis / implant attachment
  if(state.prosthesis !== "none"){
    const prosthesisKey = PROSTHESIS_SUMMARY_KEY[state.prosthesis];
    if(prosthesisKey) summary.push(t(prosthesisKey));
  }

  // Endo
  if(state.endo !== "none"){
    const endoKey = {
      "endo-medical-filling": "endo.option.medicalFilling",
      "endo-filling": "endo.option.filling",
      "endo-filling-incomplete": "endo.option.incompleteFilling",
      "endo-glass-pin": "endo.option.glassPin",
      "endo-metal-pin": "endo.option.metalPin",
    }[state.endo];
    if(endoKey) summary.push(t(endoKey));
  }

  // Filling
  if(state.fillingMaterial !== "none"){
    const fillKey = {
      amalgam: "filling.option.amalgam", composite: "filling.option.composite",
      gic: "filling.option.gic", temporary: "filling.option.temporary",
    }[state.fillingMaterial];
    if(fillKey) summary.push(t(fillKey));
  }

  // Filling defects (per filled surface).
  if(state.fillingDefect && state.fillingDefect.size > 0 && state.restorationType === "none"){
    for(const [surf, val] of state.fillingDefect){
      if(val && val !== "none" && state.fillingSurfaceMaterials.has(surf)){
        summary.push(`${t("fillingDefect.label")} (${summarySurfaceLetter(surf, toothNo)}: ${t("fillingDefect." + val)})`);
      }
    }
  }

  // Caries (+ coarse severity qualifier)
  if(state.caries.size > 0){
    const sev = cariesSeverityTierLabel(state);
    summary.push(sev ? `${t("caries.title")} (${sev})` : t("caries.title"));
  }
  // Root caries
  if(state.rootCaries && state.rootCaries !== "none"){
    summary.push(`${t("caries.rootLabel")} (${t("rootCaries." + kebabToCamel(state.rootCaries))})`);
  }
  // Clinical diagnoses
  for(const dx of diagnosisSummaryLabels(state)) summary.push(dx);
  // Coded diagnoses (DX-2)
  for(const d of getToothDiagnoses(toothNo)){
    const line = d.icd10 ? `${d.icd10Display} (${d.icd10})` : `${d.icd10Display} (${t("diagnoses.noCode")})`;
    summary.push(d.source === "added" ? `+ ${line}` : line);
  }

  // Mods
  if(state.mods.size > 0){
    for(const mod of state.mods){
      if(mod === "parodontal") summary.push(t("mods.parodontal"));
      else if(mod === "inflammation") summary.push(t("mods.periapicalInflammation"));
    }
  }
  if(state.mobility !== "none" && state.toothSelection !== "implant") summary.push(t("inflammation.mobilityLabel") + " " + t(`mobility.${state.mobility}`));

  // Findings not drawn on the chart.
  if(state.calculus) summary.push(t("calculus.label"));
  { const pi = periImplantSummaryLabel(state); if(pi) summary.push(pi); }
  { const rt = getToothRecessionType(toothNo); if(rt !== "none") summary.push(t(`perio.recession.${rt}`)); }
  { const cej = cejVisibilitySummaryLabel(state); if(cej) summary.push(cej); }
  { const rc = rootConcavitySummaryLabel(state); if(rc) summary.push(rc); }
  { const pi = plaqueIndexSummaryLine(toothNo); if(pi) summary.push(pi); }
  { const gi = gingivalIndexSummaryLine(toothNo); if(gi) summary.push(gi); }
  { const kg = keratinizedWidthSummaryLine(toothNo); if(kg) summary.push(kg); }
  { const gt = gingivalThicknessSummaryLabel(toothNo); if(gt) summary.push(gt); }
  { const mc = millerClassSummaryLabel(toothNo); if(mc) summary.push(mc); }
  { const mpi = periImplantPlaqueSummaryLine(toothNo); if(mpi) summary.push(mpi); }
  { const mbi = periImplantBleedingSummaryLine(toothNo); if(mbi) summary.push(mbi); }
  if(state.crownLeakage && !restorationRowHidden(state) && (state.restorationType === "crown" || state.restorationType === "bridge")) summary.push(t("crownLeakage.label"));
  if(state.endoResection) summary.push(t("endo.resection"));
  if(state.fissureSealing) summary.push(t("filling.fissureSealing"));
  if(state.parapulpalPin) summary.push(t("endo.parapulpalPin"));
  { const fx = fractureSummaryLabel(state); if(fx) summary.push(fx); }
  if(state.contactMesial) summary.push(t("tooth.contact.mesialMissing"));
  if(state.contactDistal) summary.push(t("tooth.contact.distalMissing"));
  if(wearRowAllowed(state)){
    if(state.wearEdge !== "none") summary.push(`${t("tooth.bruxism.edgeWear")}: ${t("wearType." + state.wearEdge)}`);
    if(state.wearCervical !== "none") summary.push(`${t("tooth.bruxism.neckWear")}: ${t("wearType." + state.wearCervical)}`);
  }
  if(discolorationAllowed(state) && state.discoloration !== "none"){
    summary.push(`${t("discoloration.label")}: ${t("discoloration." + state.discoloration)}`);
  }
  if(orthoAllowed(state)){
    if(state.orthoAppliance !== "none") summary.push(`${t("ortho.appliance.label")}: ${t("ortho.appliance." + state.orthoAppliance)}`);
    if(state.orthoDrift !== "none") summary.push(`${t("ortho.drift.label")}: ${t("ortho.drift." + state.orthoDrift)}`);
    if(state.orthoVertical !== "none") summary.push(`${t("ortho.vertical.label")}: ${t("ortho.vertical." + state.orthoVertical)}`);
    if(state.orthoRotation === true) summary.push(t("ortho.rotation.label"));
  }

  // Flags
  if(state.extractionPlan) summary.push(t("tooth.extractionPlan"));
  if(state.crownReplace) summary.push(t("tooth.crownReplace"));
  if(state.crownNeeded) summary.push(t("tooth.crownNeeded"));
  if(state.bridgePillar) summary.push(t("tooth.bridgePillar"));
  if(state.extractionWound) summary.push(t("tooth.extractionWound"));
  if(state.missingClosed) summary.push(t("tooth.missingClosed"));

  // Plugin states
  const lang = getI18nLanguage();
  for(const plugin of getRegisteredPlugins()){
    const cs = state.customStates?.[plugin.id];
    if(cs !== undefined && cs !== null){
      const label = plugin.label[lang] || plugin.label["en"] || plugin.id;
      summary.push(label);
    }
  }

  return summary;
}

/**
 * Get a human-readable summary of all active states for a tooth.
 * Useful for building custom tooltip or info-panel UIs.
 */
export function getToothStateSummary(toothNo: number): string[] {
  return getStateSummary(toothNo);
}

export function toothTableHasProblem(s: Any): boolean {
  return !!(
    (s.caries && s.caries.size > 0) ||
    (s.rootCaries && s.rootCaries !== "none") ||
    (s.pulpDx && s.pulpDx !== "normal") ||
    (s.apicalDx && s.apicalDx !== "normal") ||
    (s.periapicalType && s.periapicalType !== "none") ||
    (s.resorptionType && s.resorptionType !== "none") ||
    (s.mods && typeof s.mods.has === "function" && s.mods.has("inflammation")) ||
    (s.periImplant && s.periImplant !== "none") ||
    (s.mobility && s.mobility !== "none") ||
    (s.wearEdge && s.wearEdge !== "none") ||
    (s.wearCervical && s.wearCervical !== "none") ||
    (s.discoloration && s.discoloration !== "none")
  );
}

export function toothTableHasContent(s: Any): boolean {
  return toothTableHasProblem(s) || !!(
    (s.restorationType && s.restorationType !== "none") ||
    (s.prosthesis && s.prosthesis !== "none") ||
    (s.fillingSurfaceMaterials && s.fillingSurfaceMaterials.size > 0) ||
    (s.fillingMaterial && s.fillingMaterial !== "none") ||
    (s.endo && s.endo !== "none") ||
    s.calculus || s.crownNeeded || s.crownReplace || s.extractionPlan || s.orthoRotation ||
    (s.orthoAppliance && s.orthoAppliance !== "none") ||
    (s.orthoDrift && s.orthoDrift !== "none") ||
    (s.orthoVertical && s.orthoVertical !== "none") ||
    (s.toothSubstrate && s.toothSubstrate !== "natural")
  );
}

export function toothTableStatus(s: Any): ToothTableStatus {
  return toothTableHasProblem(s) ? "problem" : toothTableHasContent(s) ? "content" : "empty";
}

export function toothTableCategory(sel: string): string {
  return sel === "none" ? "missing" : sel === "implant" ? "implant" : sel === "milktooth" ? "primary" : "permanent";
}

export function toothTableGroupKey(toothNo: number, grouping: PdfSummaryGrouping): string {
  const q = Math.floor(toothNo / 10);
  const p = toothNo % 10;
  if(grouping === "whole") return "whole";
  if(grouping === "jaw") return (q === 1 || q === 2) ? "upper" : "lower";
  if(grouping === "quadrant") return `q${q}`;
  const posterior = p >= 4; // premolars + molars
  if(q === 1) return posterior ? "s_ur" : "s_ua";
  if(q === 2) return posterior ? "s_ul" : "s_ua";
  if(q === 4) return posterior ? "s_lr" : "s_la";
  return posterior ? "s_ll" : "s_la"; // q === 3
}

export const TOOTH_TABLE_GROUPS: Record<PdfSummaryGrouping, { key: string; labelKey: string }[]> = {
  whole: [{ key: "whole", labelKey: "summary.group.wholeMouth" }],
  jaw: [
    { key: "upper", labelKey: "summary.group.upperJaw" },
    { key: "lower", labelKey: "summary.group.lowerJaw" },
  ],
  quadrant: [
    { key: "q1", labelKey: "summary.group.upperRight" },
    { key: "q2", labelKey: "summary.group.upperLeft" },
    { key: "q3", labelKey: "summary.group.lowerLeft" },
    { key: "q4", labelKey: "summary.group.lowerRight" },
  ],
  sextant: [
    { key: "s_ur", labelKey: "summary.group.upperRightPost" },
    { key: "s_ua", labelKey: "summary.group.upperAnterior" },
    { key: "s_ul", labelKey: "summary.group.upperLeftPost" },
    { key: "s_lr", labelKey: "summary.group.lowerRightPost" },
    { key: "s_la", labelKey: "summary.group.lowerAnterior" },
    { key: "s_ll", labelKey: "summary.group.lowerLeftPost" },
  ],
};

export const TOOTH_TABLE_CATEGORIES = ["primary", "permanent", "implant", "missing"];

export function buildToothTable(
  perTooth: { toothNo: number; category: string; status: ToothTableStatus }[],
  grouping: PdfSummaryGrouping,
): OdontogramToothTable {
  const used = new Set(perTooth.map(pt => pt.category));
  const columns = TOOTH_TABLE_CATEGORIES.filter(c => used.has(c)).map(c => ({ key: c, label: t(`summary.col.${c}`) }));
  const rows = TOOTH_TABLE_GROUPS[grouping].map(g => {
    const cells: Record<string, ToothTableCell[]> = {};
    for(const col of columns) cells[col.key] = [];
    for(const pt of perTooth){
      if(toothTableGroupKey(pt.toothNo, grouping) !== g.key) continue;
      (cells[pt.category] ??= []).push({ toothNo: pt.toothNo, label: formatToothLabel(pt.toothNo), status: pt.status });
    }
    return { key: g.key, label: t(g.labelKey), cells };
  }).filter(row => columns.some(c => (row.cells[c.key] ?? []).length > 0));
  return { columns, rows, legend: t("summary.legend") };
}

/**
 * Build a human-readable, localized summary of the current odontogram state.
 */
export function getOdontogramSummary(): OdontogramSummary {
  const lbl = formatToothLabel;
  const perTooth: { toothNo: number; category: string; status: ToothTableStatus }[] = [];

  const permanent: number[] = [];
  const missing: number[] = [];
  const implants: number[] = [];
  let milkCount = 0;
  const caries: string[] = [];
  const fillings: string[] = [];
  const endo: string[] = [];
  const prosthetics: string[] = [];
  const inflamed: string[] = [];
  const diagnoses: string[] = [];
  const wear: string[] = [];
  const discoloration: string[] = [];
  const orthodontics: string[] = [];
  const notes: string[] = [];

  for(const toothNo of ALL_TEETH){
    const s = toothState.get(toothNo);
    if(!s) continue;
    if(getNotesEnabled() && s.note && s.note.trim() !== "")
      notes.push(`${formatToothLabel(toothNo)}: ${s.note.trim()}`);
    const sel = s.toothSelection;
    const isMissing = sel === "none";
    const isImplant = sel === "implant";
    const isMilk = sel === "milktooth";
    if(isMissing) missing.push(toothNo);
    else if(isImplant) implants.push(toothNo);
    else if(isMilk) milkCount++;
    else permanent.push(toothNo);
    perTooth.push({ toothNo, category: toothTableCategory(sel), status: toothTableStatus(s) });

    if(s.caries && s.caries.size > 0){
      const primary: string[] = [];
      const secondary: string[] = [];
      for(const surface of SUMMARY_SURFACE_ORDER){
        if(!s.caries.has("caries-" + surface)) continue;
        const letter = summarySurfaceLetter(surface, toothNo);
        if(s.fillingSurfaceMaterials && s.fillingSurfaceMaterials.has(surface)) secondary.push(letter);
        else primary.push(letter);
      }
      const parts: string[] = [];
      if(primary.length) parts.push(primary.join(", "));
      if(secondary.length) parts.push(secondary.join(", ") + " - " + t("toothInfo.secondary"));
      if(parts.length){
        const sev = cariesSeverityTierLabel(s);
        caries.push(`${lbl(toothNo)} (${parts.join("; ")})${sev ? " – " + sev : ""}`);
      }
    }

    if(s.rootCaries && s.rootCaries !== "none"){
      const rootKey = SUMMARY_ROOT_CARIES_KEY[s.rootCaries];
      if(rootKey) caries.push(`${lbl(toothNo)} (${t(rootKey)})`);
    }

    if(s.radiographicDepth && s.radiographicDepth.size > 0){
      const depths = SUMMARY_SURFACE_ORDER
        .filter((surface) => s.radiographicDepth.has(surface))
        .map((surface) => `${summarySurfaceLetter(surface, toothNo)}: ${t("radiographicDepth." + s.radiographicDepth.get(surface))}`);
      if(depths.length) caries.push(`${lbl(toothNo)} (${depths.join(", ")})`);
    }

    if(s.fillingSurfaceMaterials && s.fillingSurfaceMaterials.size > 0){
      const letters = SUMMARY_SURFACE_ORDER
        .filter((surface) => s.fillingSurfaceMaterials.has(surface))
        .map((surface) => summarySurfaceLetter(surface, toothNo));
      if(letters.length){
        const defects = s.restorationType === "none"
          ? SUMMARY_SURFACE_ORDER
              .filter((surface) => s.fillingDefect?.has(surface) && s.fillingSurfaceMaterials.has(surface))
              .map((surface) => `${summarySurfaceLetter(surface, toothNo)}: ${t("fillingDefect." + s.fillingDefect.get(surface))}`)
          : [];
        const suffix = defects.length ? ` – ${t("fillingDefect.label")}: ${defects.join(", ")}` : "";
        fillings.push(`${lbl(toothNo)} (${letters.join(", ")})${suffix}`);
      }
    }

    if((s.endo && s.endo !== "none") || s.endoResection){
      let name = SUMMARY_ENDO_KEY[s.endo] ? t(SUMMARY_ENDO_KEY[s.endo]) : "";
      if(s.endo === "endo-resection") name = t("toothInfo.resected");
      else if(s.endoResection) name = name ? `${name}, ${t("toothInfo.resected")}` : t("toothInfo.resected");
      endo.push(`${lbl(toothNo)} (${name})`);
    }

    if(s.restorationType && s.restorationType !== "none"){
      prosthetics.push(`${lbl(toothNo)}: ${restorationSummaryLabel(s.restorationType, s.restorationMaterial)}`);
    }
    if(s.prosthesis && s.prosthesis !== "none"){
      prosthetics.push(`${lbl(toothNo)}: ${t(PROSTHESIS_SUMMARY_KEY[s.prosthesis] || s.prosthesis)}`);
    }
    if(s.crownLeakage && !restorationRowHidden(s) && (s.restorationType === "crown" || s.restorationType === "bridge")) prosthetics.push(`${lbl(toothNo)} (${t("crownLeakage.label")})`);

    const hasInflam = s.mods && (s.mods.has("inflammation") || s.mods.has("parodontal"));
    if(hasInflam){
      let type: string;
      if(s.periapicalType && s.periapicalType !== "none") type = t("periapical.type." + s.periapicalType);
      else if(s.mods.has("parodontal")) type = t("mods.parodontal");
      else type = t("mods.periapicalInflammation");
      inflamed.push(`${lbl(toothNo)} (${type})`);
    }

    const dxs = diagnosisSummaryLabels(s);
    for(const d of getToothDiagnoses(toothNo)){
      const line = d.icd10 ? `${d.icd10Display} (${d.icd10})` : `${d.icd10Display} (${t("diagnoses.noCode")})`;
      dxs.push(d.source === "added" ? `+ ${line}` : line);
    }
    if(dxs.length) diagnoses.push(`${lbl(toothNo)} (${dxs.join("; ")})`);
    if(wearRowAllowed(s)){
      const parts: string[] = [];
      if(s.wearEdge !== "none") parts.push(`${t("tooth.bruxism.edgeWear")}: ${t("wearType." + s.wearEdge)}`);
      if(s.wearCervical !== "none") parts.push(`${t("tooth.bruxism.neckWear")}: ${t("wearType." + s.wearCervical)}`);
      if(parts.length) wear.push(`${lbl(toothNo)} (${parts.join(", ")})`);
    }
    if(discolorationAllowed(s) && s.discoloration !== "none"){
      discoloration.push(`${lbl(toothNo)} (${t("discoloration." + s.discoloration)})`);
    }
    if(orthoAllowed(s)){
      const orthoParts: string[] = [];
      if(s.orthoAppliance !== "none") orthoParts.push(t("ortho.appliance." + s.orthoAppliance));
      if(s.orthoDrift !== "none") orthoParts.push(t("ortho.drift." + s.orthoDrift));
      if(s.orthoVertical !== "none") orthoParts.push(t("ortho.vertical." + s.orthoVertical));
      if(s.orthoRotation === true) orthoParts.push(t("ortho.rotation.label"));
      if(orthoParts.length) orthodontics.push(`${lbl(toothNo)} (${orthoParts.join(", ")})`);
    }
    if(s.calculus) inflamed.push(`${lbl(toothNo)} (${t("calculus.label")})`);
    if(s.mobility && s.mobility !== "none" && s.toothSelection !== "implant") inflamed.push(`${lbl(toothNo)} (${t("inflammation.mobilityLabel")} ${t("mobility." + s.mobility)})`);
    { const pi = periImplantSummaryLabel(s); if(pi) inflamed.push(`${lbl(toothNo)} (${pi})`); }
    { const rt = getToothRecessionType(toothNo); if(rt !== "none") inflamed.push(`${lbl(toothNo)} (${t(`perio.recession.${rt}`)})`); }
    { const cej = cejVisibilitySummaryLabel(s); if(cej) inflamed.push(`${lbl(toothNo)} (${cej})`); }
    { const rc = rootConcavitySummaryLabel(s); if(rc) inflamed.push(`${lbl(toothNo)} (${rc})`); }
    { const pi = plaqueIndexSummaryLine(toothNo); if(pi) inflamed.push(`${lbl(toothNo)} (${pi})`); }
    { const gi = gingivalIndexSummaryLine(toothNo); if(gi) inflamed.push(`${lbl(toothNo)} (${gi})`); }
    { const kg = keratinizedWidthSummaryLine(toothNo); if(kg) inflamed.push(`${lbl(toothNo)} (${kg})`); }
    { const gt = gingivalThicknessSummaryLabel(toothNo); if(gt) inflamed.push(`${lbl(toothNo)} (${gt})`); }
    { const mc = millerClassSummaryLabel(toothNo); if(mc) inflamed.push(`${lbl(toothNo)} (${mc})`); }
    { const mpi = periImplantPlaqueSummaryLine(toothNo); if(mpi) inflamed.push(`${lbl(toothNo)} (${mpi})`); }
    { const mbi = periImplantBleedingSummaryLine(toothNo); if(mbi) inflamed.push(`${lbl(toothNo)} (${mbi})`); }
  }

  const plural = (base: string, n: number) => t(`${base}${n === 1 ? "One" : "Other"}`, { n });
  const milkPhrase = plural("toothInfo.milk", milkCount);
  const milkStr = milkCount > 0 ? t("toothInfo.milkFragment", { milk: milkPhrase }) : "";
  const presentPhrase = plural("toothInfo.present", permanent.length);
  const missingPhrase = plural("toothInfo.missing", missing.length);
  let overview: string;
  if(permanent.length === 0 && implants.length === 0 && milkCount > 0){
    overview = t("toothInfo.overviewMilkOnly", { milk: milkPhrase });
  }else if(implants.length > 0){
    overview = t("toothInfo.overviewImplant", { present: presentPhrase, milk: milkStr, missing: missingPhrase, implant: plural("toothInfo.implant", implants.length) });
  }else{
    overview = t("toothInfo.overview", { present: presentPhrase, milk: milkStr, missing: missingPhrase });
  }

  const permanentList = permanent.length
    ? t("toothInfo.permanentList", { count: permanent.length, list: permanent.map(lbl).join(", ") })
    : null;
  const missingList = missing.length
    ? t("toothInfo.missingList", { count: missing.length, list: missing.map(lbl).join(", ") })
    : null;

  const sections: OdontogramSummarySection[] = [
    { key: "caries", heading: t("toothInfo.caries"), items: caries, emptyText: t("toothInfo.cariesEmpty") },
    { key: "fillings", heading: t("toothInfo.fillings"), items: fillings, emptyText: t("toothInfo.fillingsEmpty") },
    { key: "endo", heading: t("toothInfo.endo"), items: endo, emptyText: t("toothInfo.endoEmpty") },
    { key: "diagnoses", heading: t("toothInfo.diagnoses"), items: diagnoses, emptyText: t("toothInfo.diagnosesEmpty") },
    { key: "wear", heading: t("toothInfo.wear"), items: wear, emptyText: t("toothInfo.wearEmpty") },
    { key: "discoloration", heading: t("toothInfo.discoloration"), items: discoloration, emptyText: t("toothInfo.discolorationEmpty") },
    { key: "orthodontics", heading: t("toothInfo.orthodontics"), items: orthodontics, emptyText: t("toothInfo.orthodonticsEmpty") },
    { key: "prosthetics", heading: t("toothInfo.prosthetics"), items: prosthetics, emptyText: t("toothInfo.prostheticsEmpty") },
  ];

  let periodontalText = inflamed.length
    ? t("toothInfo.periodontalInflamed", { list: inflamed.join(", ") })
    : t("toothInfo.periodontalHealthy");
  if(!caseMetaIsEmpty(caseMeta)){
    const fragment = caseContextSummaryFragment(caseMeta);
    if(fragment) periodontalText = `${periodontalText} – ${fragment}`;
  }
  {
    const diagnosesFragment = caseDiagnosesSummaryFragment();
    if(diagnosesFragment) periodontalText = `${periodontalText} – ${diagnosesFragment}`;
  }
  {
    const classificationFragment = classificationSummaryFragment(getPerioClassification());
    if(classificationFragment) periodontalText = `${periodontalText} – ${classificationFragment}`;
  }

  const implantInfo = implants.length
    ? { heading: t("toothInfo.implants"), text: implants.map(lbl).join(", ") }
    : null;

  const individualNotes = notes.length
    ? { heading: t("toothInfo.notes"), items: notes }
    : null;

  return {
    overview,
    permanentList,
    missingList,
    toothTable: buildToothTable(perTooth, getPdfSettings().summaryGrouping),
    periodontalHasFindings: inflamed.length > 0,
    sections,
    implants: implantInfo,
    periodontalTitle: t("toothInfo.periodontalTitle"),
    periodontalText,
    plannedChanges: getPlanChanges(),
    individualNotes,
  };
}
