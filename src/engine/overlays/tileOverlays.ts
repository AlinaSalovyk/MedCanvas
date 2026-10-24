import { el, $ } from "@/engine/domHelpers";
import { t } from "@/i18n/useI18n";
import { toLabel } from "@/utils/numbering";
import { numberingSystem } from "@/state/numbering";
import { notesEnabled } from "@/engine/sessionSettings";
import { readOnly } from "@/engine/displayGlobals";
import {
  selectedTeeth,
  activeTooth,
  setActiveTooth,
  setSelectedTeeth,
} from "@/engine/selection";

import { toothState } from "@/state/chart";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export interface ZoomPopoverDeps {
  roots: SVGElement[] | undefined;
  updateSelectionUI: () => void;
  resetToothGated: (toothNo: number) => void;
  showNoteEditor: (toothNo: number) => void;
}

export interface ContextMenuDeps {
  updateSelectionUI: () => void;
  resetToothGated: (toothNo: number) => void;
}

export interface NoteEditorDeps {
  tiles?: HTMLElement[];
  updateToothTooltip: (toothNo: number) => void;
  updateToothLabelNoteIcon: (toothNo: number) => void;
  notifyStateChange: () => void;
  state?: Any;
}

export interface TouchPoint {
  clientX: number;
  clientY: number;
}

let contextMenuTimeout: ReturnType<typeof setTimeout> | null = null;
let contextMenuCloseHandler: ((e: Event) => void) | null = null;

/**
 * Remove any mounted zoom popover overlay from the DOM.
 */
export function hideZoomPopover(): void {
  if (typeof document !== "undefined") {
    const overlay = document.querySelector(".odon-zoom-overlay");
    if (overlay) overlay.remove();
  }
}

/**
 * Remove any mounted context menu from the DOM.
 */
export function hideContextMenu(): void {
  if (contextMenuTimeout !== null) {
    clearTimeout(contextMenuTimeout);
    contextMenuTimeout = null;
  }
  if (contextMenuCloseHandler !== null && typeof document !== "undefined") {
    document.removeEventListener("touchstart", contextMenuCloseHandler, true);
    document.removeEventListener("click", contextMenuCloseHandler, true);
    contextMenuCloseHandler = null;
  }
  if (typeof document !== "undefined") {
    const menu = document.querySelector(".odon-ctx-menu");
    if (menu) menu.remove();
  }
}

/**
 * Remove any mounted note editor overlay from the DOM.
 */
export function hideNoteEditor(): void {
  if (typeof document !== "undefined") {
    const backdrop = document.querySelector(".odon-note-backdrop");
    if (backdrop) backdrop.remove();
  }
}

/**
 * Display the full zoom popover dialog for a specific tooth.
 * Clones the active side-view SVG root and presents selection, info, reset,
 * and note actions.
 */
export function showZoomPopover(
  toothNo: number,
  deps: ZoomPopoverDeps,
): void {
  hideZoomPopover();
  hideContextMenu();

  const svgs = deps.roots;
  // Find the root through the DOM rather than by position: a tooth with a
  // deciduous variant has two roots per tile, so the svg and tile registries
  // are not index-aligned, and only one of the two roots is displayed.
  const sideSvg = svgs?.find((s: Any) =>
    s.closest?.(".tooth-tile")?.classList.contains("side-view") && s.style.display !== "none",
  ) || svgs?.[0];
  if (!sideSvg) return;

  const overlay = el("div", { class: "odon-zoom-overlay" });
  const popover = el("div", { class: "odon-zoom-popover" });

  // Header
  const label = toLabel(toothNo, numberingSystem);
  const header = el("div", { class: "odon-zoom-header" });
  const title = el("span", { class: "odon-zoom-title", text: t("touch.zoom.title", { tooth: label }) });
  const closeBtn = el("button", { class: "odon-zoom-close", text: "✕" });
  closeBtn.addEventListener("click", hideZoomPopover);
  header.appendChild(title);
  header.appendChild(closeBtn);

  // SVG clone
  const svgWrap = el("div", { class: "odon-zoom-svg" });
  const clonedSvg = sideSvg.cloneNode(true) as SVGElement;
  svgWrap.appendChild(clonedSvg);

  // Actions
  const actions = el("div", { class: "odon-zoom-actions" });

  const isSelected = selectedTeeth.has(toothNo);
  const selectBtn = el("button", {
    class: isSelected ? "odon-zoom-btn active" : "odon-zoom-btn",
    text: isSelected ? t("touch.zoom.deselect") : t("touch.zoom.select"),
  });
  selectBtn.addEventListener("click", () => {
    if (selectedTeeth.has(toothNo)) {
      selectedTeeth.delete(toothNo);
      if (activeTooth === toothNo) setActiveTooth(selectedTeeth.values().next().value ?? null);
    } else {
      selectedTeeth.add(toothNo);
      setActiveTooth(toothNo);
    }
    deps.updateSelectionUI();
    hideZoomPopover();
  });

  const infoBtn = el("button", { class: "odon-zoom-btn", text: t("touch.zoom.info") });
  infoBtn.addEventListener("click", () => {
    setSelectedTeeth(new Set([toothNo]));
    setActiveTooth(toothNo);
    deps.updateSelectionUI();
    hideZoomPopover();
    // Scroll controls panel into view
    const panel = $("#controlsActions");
    if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  const resetBtn = el("button", { class: "odon-zoom-btn danger", text: t("touch.ctx.reset") });
  resetBtn.addEventListener("click", () => {
    deps.resetToothGated(toothNo);
    hideZoomPopover();
  });

  const closeActionBtn = el("button", { class: "odon-zoom-btn", text: t("touch.zoom.close") });
  closeActionBtn.addEventListener("click", hideZoomPopover);

  actions.appendChild(selectBtn);
  actions.appendChild(infoBtn);
  if (notesEnabled && !readOnly) {
    const noteBtn = el("button", { class: "odon-zoom-btn", text: t("note.title") });
    noteBtn.addEventListener("click", () => {
      hideZoomPopover();
      deps.showNoteEditor(toothNo);
    });
    actions.appendChild(noteBtn);
  }
  actions.appendChild(resetBtn);
  actions.appendChild(closeActionBtn);

  popover.appendChild(header);
  popover.appendChild(svgWrap);
  popover.appendChild(actions);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideZoomPopover();
  });

  overlay.appendChild(popover);
  document.body.appendChild(overlay);
}

/**
 * Display the touch context menu for a specific tooth near the tap location.
 */
export function showContextMenu(
  toothNo: number,
  touch: TouchPoint,
  deps: ContextMenuDeps,
): void {
  hideContextMenu();
  hideZoomPopover();

  const menu = el("div", { class: "odon-ctx-menu" });
  const isSelected = selectedTeeth.has(toothNo);

  if (isSelected) {
    const multiItem = el("button", { class: "odon-ctx-item", text: t("touch.ctx.deselect") });
    multiItem.addEventListener("click", () => {
      selectedTeeth.delete(toothNo);
      if (activeTooth === toothNo) setActiveTooth(selectedTeeth.values().next().value ?? null);
      deps.updateSelectionUI();
      hideContextMenu();
    });
    menu.appendChild(multiItem);
  } else {
    const selectItem = el("button", { class: "odon-ctx-item", text: t("touch.ctx.select") });
    selectItem.addEventListener("click", () => {
      setSelectedTeeth(new Set([toothNo]));
      setActiveTooth(toothNo);
      deps.updateSelectionUI();
      hideContextMenu();
    });
    menu.appendChild(selectItem);

    if (selectedTeeth.size > 0) {
      const multiItem = el("button", { class: "odon-ctx-item", text: t("touch.ctx.multiSelect") });
      multiItem.addEventListener("click", () => {
        selectedTeeth.add(toothNo);
        setActiveTooth(toothNo);
        deps.updateSelectionUI();
        hideContextMenu();
      });
      menu.appendChild(multiItem);
    }
  }

  menu.appendChild(el("div", { class: "odon-ctx-divider" }));

  const resetItem = el("button", { class: "odon-ctx-item danger", text: t("touch.ctx.reset") });
  resetItem.addEventListener("click", () => {
    deps.resetToothGated(toothNo);
    hideContextMenu();
  });
  menu.appendChild(resetItem);

  // Position the menu near the touch point
  const x = Math.min(touch.clientX, window.innerWidth - 200);
  const y = Math.min(touch.clientY - 10, window.innerHeight - 200);
  menu.style.left = x + "px";
  menu.style.top = y + "px";

  document.body.appendChild(menu);

  // Close on outside tap
  const closeHandler = (e: Event) => {
    if (!menu.contains(e.target as Node)) {
      hideContextMenu();
    }
  };
  contextMenuCloseHandler = closeHandler;
  contextMenuTimeout = setTimeout(() => {
    contextMenuTimeout = null;
    if (typeof document !== "undefined") {
      document.addEventListener("touchstart", closeHandler, true);
      document.addEventListener("click", closeHandler, true);
    }
  }, 50);
}

/**
 * Display the note editor popover dialog for a specific tooth.
 * Allows creating, updating, or deleting a free-text clinical note.
 */
export function showNoteEditor(
  toothNo: number,
  deps: NoteEditorDeps,
): void {
  hideNoteEditor();
  if (!notesEnabled || readOnly) return;
  const state = deps.state ?? toothState.get(toothNo);
  if (!state) return;

  // Find the side-view tile for positioning
  const tiles = deps.tiles;
  const anchorTile = tiles?.find((t: HTMLElement) => t.classList.contains("side-view")) || tiles?.[0];

  const label = toLabel(toothNo, numberingSystem);
  const popover = el("div", { class: "odon-note-popover" });

  const header = el("div", { class: "odon-note-header" });
  const title = el("span", { class: "odon-note-title", text: t("note.title") + " \u2014 " + label });
  const closeBtn = el("button", { class: "odon-zoom-close", text: "\u2715" });
  closeBtn.addEventListener("click", hideNoteEditor);
  header.appendChild(title);
  header.appendChild(closeBtn);

  const textarea = document.createElement("textarea");
  textarea.className = "odon-note-textarea";
  textarea.value = state.note || "";
  textarea.placeholder = t("note.placeholder");
  textarea.rows = 3;

  const actions = el("div", { class: "odon-note-actions" });
  const saveBtn = el("button", { class: "odon-zoom-btn", text: t("note.save") });
  // The note is part of the export payload, so a real change must notify
  // (autosave + hosts persisting the chart) like any other tooth edit.
  const commitNote = (next: string) => {
    const changed = next !== (state.note || "");
    state.note = next;
    deps.updateToothTooltip(toothNo);
    deps.updateToothLabelNoteIcon(toothNo);
    hideNoteEditor();
    if (changed) deps.notifyStateChange();
  };
  saveBtn.addEventListener("click", () => commitNote(textarea.value.trim()));
  const deleteBtn = el("button", { class: "odon-zoom-btn danger", text: t("note.delete") });
  deleteBtn.addEventListener("click", () => commitNote(""));
  actions.appendChild(saveBtn);
  actions.appendChild(deleteBtn);

  popover.appendChild(header);
  popover.appendChild(textarea);
  popover.appendChild(actions);

  // Backdrop
  const backdrop = el("div", { class: "odon-note-backdrop" });
  backdrop.addEventListener("click", hideNoteEditor);
  backdrop.appendChild(popover);
  document.body.appendChild(backdrop);

  popover.addEventListener("click", (e) => e.stopPropagation());

  // Position popover near the tooth tile
  if (anchorTile) {
    const rect = anchorTile.getBoundingClientRect();
    const pw = 320; // popover width
    let left = rect.left + rect.width / 2 - pw / 2;
    let top = rect.bottom + 8;
    // Clamp to viewport
    if (left < 8) left = 8;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    if (top + 200 > window.innerHeight) top = rect.top - 208;
    popover.style.position = "fixed";
    popover.style.left = left + "px";
    popover.style.top = top + "px";
  }

  textarea.focus();
}

