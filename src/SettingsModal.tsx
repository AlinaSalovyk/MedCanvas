import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  TFn,
  SettingsState,
  SettingsTab,
  FillingComplexity,
  TabContext,
  ScreenToothSpacing,
  ScreenToothNumberSize,
  SelectionBorderStyle,
} from "./features/settings/types";
import { FILLING_MATERIAL_KEYS } from "./features/settings/types";
import { SETTINGS_TABS } from "./features/settings/tabs";

export type {
  TFn,
  SettingsState,
  SettingsTab,
  FillingComplexity,
  TabContext,
  ScreenToothSpacing,
  ScreenToothNumberSize,
  SelectionBorderStyle,
};
export { FILLING_MATERIAL_KEYS, SETTINGS_TABS };

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus-trapped, ARIA-labelled settings dialog. Opened from the topbar gear.
 *
 * - `role="dialog"` + `aria-modal`, labelled by its title.
 * - Esc closes; backdrop click closes; focus is trapped inside while open and
 *   returned to the opener element on close.
 * - Content is driven by the declarative {@link SETTINGS_TABS} registry.
 */
export default function SettingsModal({
  open,
  onClose,
  t,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  t: TFn;
  settings: SettingsState;
}) {
  const [activeTab, setActiveTab] = useState<string>(SETTINGS_TABS[0].id);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const tablistRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Capture the opener + move focus into the dialog when it opens; restore
  // focus to the opener when it closes/unmounts.
  useEffect(() => {
    if (!open) return;
    openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    return () => {
      openerRef.current?.focus?.();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
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
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    },
    [onClose],
  );

  // APG-tabs keyboard support on the tablist. With a roving tabindex only the
  // active tab is Tab-reachable, so without this handler the other tabs are
  // mouse-only. Arrow Left/Right (and Up/Down) move between tabs wrapping;
  // Home → first, End → last.
  const onTabListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const nav = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"];
      if (!nav.includes(e.key)) return;
      e.preventDefault();
      const count = SETTINGS_TABS.length;
      if (count === 0) return;
      const cur = SETTINGS_TABS.findIndex((tab) => tab.id === activeTab);
      const idx = cur < 0 ? 0 : cur;
      let next = idx;
      if (e.key === "Home") next = 0;
      else if (e.key === "End") next = count - 1;
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % count;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + count) % count;
      const nextTab = SETTINGS_TABS[next];
      if (!nextTab) return;
      if (nextTab.id !== activeTab) setActiveTab(nextTab.id);
      tablistRef.current
        ?.querySelector<HTMLElement>(`#odon-settings-tab-${nextTab.id}`)
        ?.focus();
    },
    [activeTab],
  );

  if (!open) return null;

  const resolvedTab = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0];
  // Never show the Export Settings panel when PDF export is off (the tab is
  // disabled) — fall back to the first tab.
  const current = resolvedTab.id === "export" && settings.exportPdf === false
    ? SETTINGS_TABS[0]
    : resolvedTab;

  return (
    <div
      className="odon-settings-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="odon-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="odon-settings-header">
          <h2 className="odon-settings-title" id={titleId}>
            {t("settings.title")}
          </h2>
          <button
            type="button"
            className="odon-settings-close"
            onClick={onClose}
            aria-label={t("settings.close")}
            title={t("settings.close")}
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
        <div className="odon-settings-body">
          <div
            ref={tablistRef}
            className="odon-settings-tabs"
            role="tablist"
            aria-label={t("settings.title")}
            onKeyDown={onTabListKeyDown}
          >
            {SETTINGS_TABS.map((tab) => {
              // The Export Settings tab is disabled when PDF export is turned
              // off in General — its settings would have no effect.
              const tabDisabled = tab.id === "export" && settings.exportPdf === false;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`odon-settings-tab-${tab.id}`}
                  aria-selected={tab.id === activeTab}
                  aria-controls={`odon-settings-panel-${tab.id}`}
                  aria-disabled={tabDisabled || undefined}
                  tabIndex={tab.id === activeTab ? 0 : -1}
                  className={
                    "odon-settings-tab" + (tab.id === activeTab ? " is-active" : "") +
                    (tabDisabled ? " is-disabled" : "")
                  }
                  onClick={() => { if (!tabDisabled) setActiveTab(tab.id); }}
                >
                  {t(tab.titleKey)}
                </button>
              );
            })}
          </div>
          <div
            className="odon-settings-panel"
            role="tabpanel"
            id={`odon-settings-panel-${current.id}`}
            aria-labelledby={`odon-settings-tab-${current.id}`}
          >
            {current.render({ t, s: settings })}
          </div>
        </div>
      </div>
    </div>
  );
}
