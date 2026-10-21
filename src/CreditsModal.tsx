import { useRef, useId } from "react";
import { useDialogFocus } from "./hooks/useDialogFocus";

/** Translation function signature (subset of `useI18n`'s `t`). */
type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Human contributors and what each one added. Kept as data so a new
 *  contributor is a one-line addition here (and in the language READMEs).
 *  Claude / the AI assistant is intentionally never listed. */
const CONTRIBUTORS: { handle: string; descKey: string }[] = [
  { handle: "odontodev", descKey: "credits.contrib.odontodev" },
  { handle: "JulianoBazzi", descKey: "credits.contrib.julianobazzi" },
  { handle: "yassine-bhn", descKey: "credits.contrib.yassine" },
  { handle: "saegerdirk-star", descKey: "credits.contrib.saegerdirk" },
];

/** External projects the app is built with. Names are proper nouns (not
 *  translated); each links to its home. */
const LIBRARIES: { name: string; url: string }[] = [
  { name: "jsPDF", url: "https://github.com/parallax/jsPDF" },
  { name: "DOMPurify", url: "https://github.com/cure53/DOMPurify" },
  { name: "React", url: "https://react.dev" },
  { name: "Vite", url: "https://vite.dev" },
  { name: "TypeScript", url: "https://www.typescriptlang.org" },
];

/**
 * The "About and credits" popup. Mirrors {@link DualStateConfirm}'s dialog
 * contract: `role="dialog"` + `aria-modal`, Escape closes, backdrop click
 * closes, focus is trapped while open and returned to the opener on close.
 * Opened from the topbar Credits button (`creditsOpen` in the UI context).
 */
export default function CreditsModal({
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

  if (!open) return null;

  return (
    <div
      className="odon-confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="creditsModal"
        ref={dialogRef}
        className="odon-credits-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="odon-settings-close" onClick={onClose} aria-label={t("credits.close")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>

        <h2 className="odon-credits-title" id={titleId}>{t("credits.title")}</h2>

        <div className="odon-credits-body">
          <p className="odon-credits-intro">{t("credits.intro")}</p>

          <section className="odon-credits-section">
            <h3 className="odon-credits-heading">{t("credits.contributorsTitle")}</h3>
            <ul className="odon-credits-list">
              {CONTRIBUTORS.map((c) => (
                <li key={c.handle}>
                  <a
                    className="odon-credits-link"
                    href={`https://github.com/${c.handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{c.handle}
                  </a>
                  <span className="odon-credits-desc">{t(c.descKey)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="odon-credits-section">
            <h3 className="odon-credits-heading">{t("credits.librariesTitle")}</h3>
            <ul className="odon-credits-libs">
              {LIBRARIES.map((l) => (
                <li key={l.name}>
                  <a className="odon-credits-link" href={l.url} target="_blank" rel="noopener noreferrer">{l.name}</a>
                </li>
              ))}
            </ul>
          </section>

          <p className="odon-credits-welcome">{t("credits.welcome")}</p>
        </div>
      </div>
    </div>
  );
}
