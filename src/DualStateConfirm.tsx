import { useRef, useId } from "react";
import { useDialogFocus } from "./hooks/useDialogFocus";

/** Translation function signature (subset of `useI18n`'s `t`). */
type TFn = (key: string, params?: Record<string, string | number>) => string;

/**
 * Blocking confirm dialog shown BEFORE a status-mode edit is applied to a tooth
 * the user has already planned (which would make the status chart diverge from
 * the plan). Mirrors {@link SettingsModal}'s dialog contract:
 *
 * - `role="dialog"` + `aria-modal`, labelled by its message; root id
 *   `#dualStateConfirm`.
 * - Esc cancels; backdrop click cancels; focus is trapped inside while open and
 *   returned to the opener element on close.
 * - Accept applies the divergent edit, cancel reverts the control. Both labels
 *   and the message come through `t`.
 *
 * The dialog owns no state — accept/cancel are driven entirely by the caller
 * (the odontogram module's deferred `apply`/`revert`), so the same instance can
 * back a single-tooth edit or a whole batch.
 */
export default function DualStateConfirm({
  open,
  t,
  onAccept,
  onCancel,
}: {
  open: boolean;
  t: TFn;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const { onKeyDown } = useDialogFocus({ open, onClose: onCancel, dialogRef });

  if (!open) return null;

  return (
    <div
      className="odon-confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        id="dualStateConfirm"
        ref={dialogRef}
        className="odon-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <p className="odon-confirm-message" id={titleId}>
          {t("dualState.confirmPlannedStatusEdit")}
        </p>
        <div className="odon-confirm-actions">
          <button
            type="button"
            className="odon-confirm-btn odon-confirm-cancel"
            onClick={onCancel}
          >
            {t("dualState.cancel")}
          </button>
          <button
            type="button"
            className="odon-confirm-btn odon-confirm-accept"
            onClick={onAccept}
          >
            {t("dualState.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
