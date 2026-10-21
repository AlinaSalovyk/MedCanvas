import type {
  PdfDateFormat,
  PdfToothSpacing,
  PdfBorderThickness,
  PdfToothNumberSize,
  PdfSummaryGrouping,
  PdfPerioLabelPlacement,
  PdfPerioFontSize,
} from "@/odontogram";
import type { PdfColorTheme } from "@/perioPdf";
import { InputRow, SelectRow, ToggleRow, TextAreaRow } from "../components/SettingControls";
import {
  PDF_DATE_FORMAT_OPTIONS,
  PDF_COLOR_THEME_OPTIONS,
  PDF_TOOTH_SPACING_OPTIONS,
  PDF_BORDER_THICKNESS_OPTIONS,
  PDF_TOOTH_NUMBER_SIZE_OPTIONS,
  PDF_SUMMARY_GROUPING_OPTIONS,
  PDF_PERIO_PLACEMENT_OPTIONS,
  PDF_PERIO_FONT_OPTIONS,
  type TabContext,
} from "../types";

export function ExportTab({ t, s }: TabContext) {
  return (
    <>
      <div className="odon-settings-note">{t("settings.export.appliesNote")}</div>
      <InputRow
        t={t}
        label={t("settings.pdf.defaultName")}
        descKey="settings.pdf.defaultName.desc"
        value={s.pdfSettings.defaultName}
        onChange={(v) => s.onPdfSettings({ defaultName: v })}
      />
      <InputRow
        t={t}
        label={t("settings.pdf.defaultDob")}
        descKey="settings.pdf.defaultDob.desc"
        type="date"
        value={s.pdfSettings.defaultDob}
        onChange={(v) => s.onPdfSettings({ defaultDob: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.showAge")}
        descKey="settings.pdf.showAge.desc"
        checked={s.pdfSettings.showAge}
        onChange={(v) => s.onPdfSettings({ showAge: v })}
      />
      <SelectRow<PdfDateFormat>
        t={t}
        label={t("settings.pdf.dateFormat")}
        descKey="settings.pdf.dateFormat.desc"
        value={s.pdfSettings.dateFormat}
        options={PDF_DATE_FORMAT_OPTIONS}
        onChange={(v) => s.onPdfSettings({ dateFormat: v })}
      />
      <SelectRow<PdfColorTheme>
        t={t}
        label={t("settings.pdf.theme")}
        descKey="settings.pdf.theme.desc"
        value={s.pdfSettings.colorTheme}
        options={PDF_COLOR_THEME_OPTIONS}
        onChange={(v) => s.onPdfSettings({ colorTheme: v })}
      />

      <div className="odon-settings-group-title">{t("settings.pdf.section.odontogram")}</div>
      <ToggleRow
        t={t}
        label={t("settings.pdf.showBone")}
        descKey="settings.pdf.showBone.desc"
        checked={s.pdfSettings.showBone}
        onChange={(v) => s.onPdfSettings({ showBone: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.showHealthyPulp")}
        descKey="settings.pdf.showHealthyPulp.desc"
        checked={s.pdfSettings.showHealthyPulp}
        onChange={(v) => s.onPdfSettings({ showHealthyPulp: v })}
      />
      <SelectRow<PdfToothSpacing>
        t={t}
        label={t("settings.pdf.spacing")}
        descKey="settings.pdf.spacing.desc"
        value={s.pdfSettings.toothSpacing}
        options={PDF_TOOTH_SPACING_OPTIONS}
        onChange={(v) => s.onPdfSettings({ toothSpacing: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.border")}
        descKey="settings.pdf.border.desc"
        checked={s.pdfSettings.border}
        onChange={(v) => s.onPdfSettings({ border: v })}
      />
      <SelectRow<PdfBorderThickness>
        t={t}
        label={t("settings.pdf.borderThickness")}
        descKey="settings.pdf.borderThickness.desc"
        value={s.pdfSettings.borderThickness}
        options={PDF_BORDER_THICKNESS_OPTIONS}
        onChange={(v) => s.onPdfSettings({ borderThickness: v })}
        disabled={!s.pdfSettings.border}
      />
      <SelectRow<PdfToothNumberSize>
        t={t}
        label={t("settings.pdf.numberSize")}
        descKey="settings.pdf.numberSize.desc"
        value={s.pdfSettings.toothNumberSize}
        options={PDF_TOOTH_NUMBER_SIZE_OPTIONS}
        onChange={(v) => s.onPdfSettings({ toothNumberSize: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.includeText")}
        descKey="settings.pdf.includeText.desc"
        checked={s.pdfSettings.includeOdontogramText}
        onChange={(v) => s.onPdfSettings({ includeOdontogramText: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.includeTable")}
        descKey="settings.pdf.includeTable.desc"
        checked={s.pdfSettings.includeOdontogramTable}
        onChange={(v) => s.onPdfSettings({ includeOdontogramTable: v })}
      />
      <SelectRow<PdfSummaryGrouping>
        t={t}
        label={t("settings.pdf.summaryGrouping")}
        descKey="settings.pdf.summaryGrouping.desc"
        value={s.pdfSettings.summaryGrouping}
        options={PDF_SUMMARY_GROUPING_OPTIONS}
        onChange={(v) => s.onPdfSettings({ summaryGrouping: v })}
      />

      <div className="odon-settings-group-title">{t("settings.pdf.section.perio")}</div>
      <SelectRow<PdfToothSpacing>
        t={t}
        label={t("settings.pdf.perioSpacing")}
        descKey="settings.pdf.perioSpacing.desc"
        value={s.pdfSettings.perioToothSpacing}
        options={PDF_TOOTH_SPACING_OPTIONS}
        onChange={(v) => s.onPdfSettings({ perioToothSpacing: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.perioEmptyRows")}
        descKey="settings.pdf.perioEmptyRows.desc"
        checked={s.pdfSettings.perioShowEmptyRows}
        onChange={(v) => s.onPdfSettings({ perioShowEmptyRows: v })}
      />
      <SelectRow<PdfPerioLabelPlacement>
        t={t}
        label={t("settings.pdf.perioPlacement")}
        descKey="settings.pdf.perioPlacement.desc"
        value={s.pdfSettings.perioLabelPlacement}
        options={PDF_PERIO_PLACEMENT_OPTIONS}
        onChange={(v) => s.onPdfSettings({ perioLabelPlacement: v })}
      />
      <SelectRow<PdfPerioFontSize>
        t={t}
        label={t("settings.pdf.perioFont")}
        descKey="settings.pdf.perioFont.desc"
        value={s.pdfSettings.perioFontSize}
        options={PDF_PERIO_FONT_OPTIONS}
        onChange={(v) => s.onPdfSettings({ perioFontSize: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.includePerioTable")}
        descKey="settings.pdf.includePerioTable.desc"
        checked={s.pdfSettings.includePerioTable}
        onChange={(v) => s.onPdfSettings({ includePerioTable: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.includePerioAbbrev")}
        descKey="settings.pdf.includePerioAbbrev.desc"
        checked={s.pdfSettings.includePerioAbbrev}
        onChange={(v) => s.onPdfSettings({ includePerioAbbrev: v })}
      />

      <div className="odon-settings-group-title">{t("settings.pdf.section.footer")}</div>
      <ToggleRow
        t={t}
        label={t("settings.pdf.showDisclaimer")}
        descKey="settings.pdf.showDisclaimer.desc"
        checked={s.pdfSettings.showDisclaimer}
        onChange={(v) => s.onPdfSettings({ showDisclaimer: v })}
      />
      <TextAreaRow
        t={t}
        label={t("settings.pdf.disclaimerText")}
        descKey="settings.pdf.disclaimerText.desc"
        value={s.pdfSettings.disclaimerText}
        placeholder={t("pdf.disclaimer")}
        disabled={!s.pdfSettings.showDisclaimer}
        onChange={(v) => s.onPdfSettings({ disclaimerText: v })}
      />
      <ToggleRow
        t={t}
        label={t("settings.pdf.showGenerator")}
        descKey="settings.pdf.showGenerator.desc"
        checked={s.pdfSettings.showGenerator}
        onChange={(v) => s.onPdfSettings({ showGenerator: v })}
      />
    </>
  );
}
