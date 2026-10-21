import type { NumberingSystem } from "@/utils/numbering";
import type { Language } from "@/i18n/languages";
import { SelectRow, ToggleRow } from "../components/SettingControls";
import {
  NUMBERING_OPTIONS,
  LANGUAGE_OPTIONS,
  DIAGNOSIS_CODING_OPTIONS,
  type TabContext,
} from "../types";

export function GeneralTab({ t, s }: TabContext) {
  return (
    <>
      <SelectRow<NumberingSystem>
        t={t}
        label={t("numbering.label")}
        descKey="settings.numbering.desc"
        value={s.numbering}
        options={NUMBERING_OPTIONS}
        onChange={s.onNumbering}
      />
      <SelectRow<Language>
        t={t}
        label={t("language.label")}
        descKey="settings.language.desc"
        value={s.language}
        options={LANGUAGE_OPTIONS}
        onChange={s.onLanguage}
      />
      <ToggleRow
        t={t}
        label={t("settings.theme.label")}
        descKey="settings.theme.desc"
        checked={s.isDark}
        onChange={() => s.onToggleDark()}
      />
      <div className="odon-settings-group-title">{t("settings.export.section")}</div>
      <ToggleRow
        t={t}
        label={t("settings.export.png")}
        descKey="settings.export.png.desc"
        checked={s.exportPng}
        onChange={s.onExportPng}
      />
      <ToggleRow
        t={t}
        label={t("settings.export.jpg")}
        descKey="settings.export.jpg.desc"
        checked={s.exportJpg}
        onChange={s.onExportJpg}
      />
      <ToggleRow
        t={t}
        label={t("settings.export.svg")}
        descKey="settings.export.svg.desc"
        checked={s.exportSvg}
        onChange={s.onExportSvg}
      />
      <ToggleRow
        t={t}
        label={t("settings.export.pdf")}
        descKey="settings.export.pdf.desc"
        checked={s.exportPdf}
        onChange={s.onExportPdf}
      />
      <div className="odon-settings-group-title">{t("settings.import.section")}</div>
      <ToggleRow
        t={t}
        label={t("settings.import.status")}
        descKey="settings.import.status.desc"
        checked={s.importStatus}
        onChange={s.onImportStatus}
      />
      <ToggleRow
        t={t}
        label={t("settings.import.fhir")}
        descKey="settings.import.fhir.desc"
        checked={s.importFhir}
        onChange={s.onImportFhir}
      />
      <SelectRow<string>
        t={t}
        label={t("settings.diagnosisCoding")}
        descKey="settings.diagnosisCoding.desc"
        value={s.codingPack}
        options={DIAGNOSIS_CODING_OPTIONS}
        onChange={s.onDiagnosisCodingPack}
      />
      <ToggleRow
        t={t}
        label={t("settings.snomed")}
        descKey="settings.snomed.desc"
        checked={s.snomedEnabled}
        onChange={s.onSnomedEnabled}
      />
    </>
  );
}
