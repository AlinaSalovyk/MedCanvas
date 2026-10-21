import { useCallback, useEffect, useId, useRef, useState } from "react";
import { t } from "@/i18n/useI18n";
import {
  getToothAnatomy,
  getPerioOverlayLayer,
  setPerioOverlayLayer,
  onStateChange,
  type PerioOverlayLayer,
} from "@/odontogram";
import type { TemplateDocCache } from "@/perioGraphic";
import PerioSidebar from "@/PerioSidebar";
import { FOCUSABLE } from "@/features/perio/chart/constants";
import { PerioOverlaySwitch } from "@/features/perio/chart/PerioOverlaySwitch";
import { usePerioGrid } from "@/features/perio/chart/usePerioGrid";
import { usePerioGraphics } from "@/features/perio/chart/usePerioGraphics";

export { drawArchOverlay } from "@/features/perio/chart/archDraw";

/**
 * Full-mouth perio-chart.
 *
 * Layers OVER the odontogram when open in modal mode (`!inline`), or renders
 * embedded as `#perioInlinePanel` when `inline` is true.
 */
export default function PerioChart({
  open = false,
  onClose,
  inline = false,
}: {
  open?: boolean;
  onClose?: () => void;
  inline?: boolean;
}) {
  const active = inline || open;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const archCacheRef = useRef<TemplateDocCache | null>(null);

  const [overlayLayer, setOverlayLayer] = useState<PerioOverlayLayer>("none");
  const [anatomy, setAnatomy] = useState(() => getToothAnatomy());

  const {
    summary,
    buccalUpperRef,
    palatalUpperRef,
    buccalLowerRef,
    palatalLowerRef,
    gridUpperRef,
    gridLowerRef,
  } = usePerioGrid({
    active,
    scrollRef,
    archCacheRef,
  });

  usePerioGraphics({
    active,
    anatomy,
    scrollRef,
    buccalUpperRef,
    palatalUpperRef,
    buccalLowerRef,
    palatalLowerRef,
    gridUpperRef,
    gridLowerRef,
    archCacheRef,
  });

  // Focus capture / restore for modal dialog
  useEffect(() => {
    if (inline || !open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [inline, open]);

  // Mirror the module-level overlay-layer flag into React state
  useEffect(() => {
    if (!active) return;
    setOverlayLayer(getPerioOverlayLayer());
    const unsubscribe = onStateChange(() => setOverlayLayer(getPerioOverlayLayer()));
    return unsubscribe;
  }, [active]);

  // Mirror the module-level anatomy profile
  useEffect(() => {
    if (!active) return;
    setAnatomy(getToothAnatomy());
    return onStateChange(() => setAnatomy(getToothAnatomy()));
  }, [active]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && activeEl === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    },
    [onClose],
  );

  if (!active) return null;

  const overlaySwitch = (
    <PerioOverlaySwitch
      overlayLayer={overlayLayer}
      onSelectLayer={setPerioOverlayLayer}
      summary={summary}
    />
  );

  const gridBody = (
    <div
      id={inline ? "perioInlineGrid" : "perioOverlayGrid"}
      className="perio-overlay-body"
      aria-label={t("perio.chart.title")}
    >
      <div className="perio-fullgrid-scroll" ref={scrollRef}></div>
    </div>
  );

  if (inline) {
    return (
      <section id="perioInlinePanel" className="chart perio-inline-panel" aria-label={t("perio.chart.title")}>
        <div className="chart-header perio-chart-header">
          <div className="chart-title">{t("perio.chart.title")}</div>
          {overlaySwitch}
        </div>
        {gridBody}
      </section>
    );
  }

  return (
    <div
      ref={dialogRef}
      id="perioOverlay"
      className="perio-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="perio-overlay-panel">
        <div className="perio-overlay-header">
          <h2 className="perio-overlay-title" id={titleId}>
            {t("perio.chart.title")}
          </h2>
          {overlaySwitch}
          <button
            type="button"
            className="perio-overlay-close"
            onClick={onClose}
            aria-label={t("perio.close")}
            title={t("perio.close")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <PerioSidebar />
        {gridBody}
      </div>
    </div>
  );
}
