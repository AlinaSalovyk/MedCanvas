import { useEffect, useRef, useState, useId } from "react";
import {
  exportPdf,
  hasAnyPerioData,
  hasAnyToothNote,
  getCaseMeta,
  setPatientName,
  setPatientDob,
  setExamDate,
  onStateChange,
} from "./odontogram";
import type { PdfExportOptions } from "./perioPdf";
import { useDialogFocus } from "./hooks/useDialogFocus";

/** Translation function signature (subset of `useI18n`'s `t`). */
type TFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * The "PDF report…" export-settings dialog. Mirrors {@link DualStateConfirm}'s
 * dialog contract exactly:
 *
 * - `.odon-confirm-backdrop` / `.odon-confirm-modal`, `role="dialog"` +
 *   `aria-modal`, labelled via `useId()`.
 * - Esc cancels; backdrop click cancels; focus is trapped inside while open
 *   and returned to the opener element on close.
 *
 * Behavior: checkboxes (all default ON) for the report sections — patient data,
 * odontogram chart, odontogram description, individual notes, perio status,
 * perio description — plus name/exam-date inputs that write straight through the
 * `setPatientName`/`setExamDate` setters (same pattern as `PerioSidebar`'s
 * case-meta panel). When {@link hasAnyPerioData} is false the two perio
 * checkboxes are `disabled` (a "no perio data" note is shown) and forced off in
 * the opts handed to `exportPdf()` regardless of their checked state —
 * belt-and-suspenders on top of `exportPdf()`'s own internal auto-skip. The
 * individual-notes checkbox is likewise disabled when no tooth carries a note.
 */
export default function ExportOptionsModal({
  open,
  t,
  onClose,
}: {
  open: boolean;
  t: TFn;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const { onKeyDown } = useDialogFocus({ open, onClose, dialogRef });

  const [patientData, setPatientDataOpt] = useState(true);
  // Odontogram chart and description are independently-selectable checkboxes,
  // plus a third for per-tooth notes.
  const [odontogramChart, setOdontogramChartOpt] = useState(true);
  const [odontogramDescription, setOdontogramDescriptionOpt] = useState(true);
  const [individualNotes, setIndividualNotesOpt] = useState(true);
  const [perioStatus, setPerioStatusOpt] = useState(true);
  const [perioDescription, setPerioDescriptionOpt] = useState(true);
  const [hasPerio, setHasPerio] = useState(false);
  // Whether any tooth carries a note — drives the notes checkbox's `disabled`
  // state (mirrors `hasPerio`/the perio checkboxes).
  const [hasNotes, setHasNotes] = useState(false);
  const [caseMeta, setCaseMetaState] = useState(getCaseMeta());
  // Local, decoupled buffer for the patient-name input. `setPatientName` trims
  // on every call, and the `onStateChange` re-sync below would snap a
  // just-typed trailing space back — making it impossible to type a space
  // ("John Doe"). So the input is driven by this local buffer and only
  // committed (trimmed) on blur and at export time, never per keystroke.
  const [nameInput, setNameInput] = useState(getCaseMeta().patientName ?? "");

  // (Re)read hasPerio + caseMeta so the dialog reflects the current chart every time it opens.
  useEffect(() => {
    if (!open) return;
    setHasPerio(hasAnyPerioData());
    setHasNotes(hasAnyToothNote());
    // Exam date defaults to today (still editable) when the case has none — so
    // a fresh report is dated without the user having to fill it in.
    if (getCaseMeta().examDate === null) {
      setExamDate(new Date().toISOString().slice(0, 10));
    }
    setCaseMetaState(getCaseMeta());
    setNameInput(getCaseMeta().patientName ?? "");
  }, [open]);

  // Keep the name/exam-date inputs (and the hasPerio gate) in sync with the
  // module while the dialog is open, mirroring PerioSidebar's caseMeta
  // subscription.
  useEffect(() => {
    if (!open) return;
    return onStateChange(() => {
      setCaseMetaState(getCaseMeta());
      setHasPerio(hasAnyPerioData());
      setHasNotes(hasAnyToothNote());
    });
  }, [open]);

  if (!open) return null;

  const handleExport = () => {
    setPatientName(nameInput.trim() === "" ? null : nameInput);
    const opts: PdfExportOptions = {
      patientData,
      odontogramChart,
      odontogramDescription,
      individualNotes: individualNotes && hasNotes,
      perioStatus: perioStatus && hasPerio,
      perioDescription: perioDescription && hasPerio,
    };
    exportPdf(opts).catch((err) => console.error("exportPdf failed", err));
    onClose();
  };

  return (
    <div
      className="odon-confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="exportOptionsModal"
        ref={dialogRef}
        className="odon-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <p className="odon-confirm-message" id={titleId}>
          {t("export.options.title")}
        </p>

        <div className="case-meta-row">
          <label className="case-meta-row-label" htmlFor="exportOptionsPatientName">
            {t("case.patientName")}
          </label>
          <input
            id="exportOptionsPatientName"
            className="case-meta-input"
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => setPatientName(nameInput.trim() === "" ? null : nameInput)}
          />
        </div>
        <div className="case-meta-row">
          <label className="case-meta-row-label" htmlFor="exportOptionsPatientDob">
            {t("case.patientDob")}
          </label>
          <input
            id="exportOptionsPatientDob"
            className="case-meta-input"
            type="date"
            value={caseMeta.patientDob ?? ""}
            onChange={(e) => setPatientDob(e.target.value === "" ? null : e.target.value)}
          />
        </div>
        <div className="case-meta-row">
          <label className="case-meta-row-label" htmlFor="exportOptionsExamDate">
            {t("case.examDate")}
          </label>
          <input
            id="exportOptionsExamDate"
            className="case-meta-input"
            type="date"
            value={caseMeta.examDate ?? ""}
            onChange={(e) => setExamDate(e.target.value === "" ? null : e.target.value)}
          />
        </div>

        <label>
          <input
            type="checkbox"
            checked={patientData}
            onChange={(e) => setPatientDataOpt(e.target.checked)}
          />
          <span>{t("export.options.patientData")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={odontogramChart}
            onChange={(e) => setOdontogramChartOpt(e.target.checked)}
          />
          <span>{t("export.options.odontogramChart")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={odontogramDescription}
            onChange={(e) => setOdontogramDescriptionOpt(e.target.checked)}
          />
          <span>{t("export.options.odontogramDescription")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={individualNotes}
            disabled={!hasNotes}
            onChange={(e) => setIndividualNotesOpt(e.target.checked)}
          />
          <span>{t("toothInfo.notes")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={perioStatus}
            disabled={!hasPerio}
            onChange={(e) => setPerioStatusOpt(e.target.checked)}
          />
          <span>{t("export.options.perioStatus")}</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={perioDescription}
            disabled={!hasPerio}
            onChange={(e) => setPerioDescriptionOpt(e.target.checked)}
          />
          <span>{t("export.options.perioDescription")}</span>
        </label>
        {!hasPerio && <p className="hint">{t("export.options.noPerio")}</p>}

        <div className="odon-confirm-actions">
          <button
            type="button"
            className="odon-confirm-btn odon-confirm-cancel"
            onClick={onClose}
          >
            {t("export.options.cancel")}
          </button>
          <button
            type="button"
            className="odon-confirm-btn odon-confirm-accept"
            onClick={handleExport}
          >
            {t("export.options.export")}
          </button>
        </div>
      </div>
    </div>
  );
}
