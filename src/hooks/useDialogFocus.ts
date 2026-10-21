import { useCallback, useEffect, useRef } from "react";

export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseDialogFocusOptions {
  open: boolean;
  onClose?: () => void;
  dialogRef: React.RefObject<HTMLElement | null>;
}

/**
 * Standard accessible dialog focus management hook:
 * - Captures the active opener element upon opening.
 * - Moves focus to the first focusable element (or dialog itself).
 * - Restores focus to the opener element upon closing.
 * - Traps Tab and Shift+Tab navigation within the dialog.
 * - Closes on Escape.
 */
export function useDialogFocus({
  open,
  onClose,
  dialogRef,
}: UseDialogFocusOptions) {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? dialog)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [open, dialogRef]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    },
    [onClose, dialogRef]
  );

  return { onKeyDown };
}
