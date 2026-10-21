import { t } from "@/i18n/useI18n";

export function mkEl<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** At most ONE row-label info popover is open across the whole perio chart
 *  at any time — module-scope singleton. */
let activeInfoPopover: {
  popover: HTMLDivElement;
  button: HTMLButtonElement;
  cleanup: () => void;
} | null = null;

export function hideInfoPopover(): void {
  if (!activeInfoPopover) return;
  const { popover, button, cleanup } = activeInfoPopover;
  cleanup();
  popover.remove();
  button.setAttribute("aria-expanded", "false");
  activeInfoPopover = null;
}

/** Open (or, when the SAME button is clicked again, close) a lightweight
 *  positioned popover explaining one perio index (`t(infoKey)`), anchored
 *  below the row-label "i" button that triggered it. */
export function toggleInfoPopover(infoKey: string, anchor: HTMLButtonElement): void {
  const reopening = activeInfoPopover?.button === anchor;
  hideInfoPopover();
  if (reopening) return;

  const popover = mkEl("div", "perio-info-popover");
  popover.id = "perioInfoPopover";
  popover.setAttribute("role", "dialog");
  popover.setAttribute("aria-modal", "false");
  const text = mkEl("p", "perio-info-popover-text");
  text.textContent = t(infoKey);
  popover.appendChild(text);
  popover.setAttribute("aria-label", text.textContent);
  document.body.appendChild(popover);

  const rect = anchor.getBoundingClientRect();
  const pw = popover.offsetWidth || 260;
  const left = Math.min(rect.left, window.innerWidth - pw - 8);
  const top = Math.min(rect.bottom + 6, window.innerHeight - (popover.offsetHeight || 0) - 8);
  popover.style.left = `${Math.max(8, left)}px`;
  popover.style.top = `${Math.max(8, top)}px`;

  anchor.setAttribute("aria-expanded", "true");

  const onDocMouseDown = (e: MouseEvent) => {
    const target = e.target as Node | null;
    if (target && (popover.contains(target) || anchor.contains(target))) return;
    hideInfoPopover();
  };
  const onDocKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      hideInfoPopover();
    }
  };
  document.addEventListener("mousedown", onDocMouseDown, true);
  document.addEventListener("keydown", onDocKeyDown, true);

  activeInfoPopover = {
    popover,
    button: anchor,
    cleanup: () => {
      document.removeEventListener("mousedown", onDocMouseDown, true);
      document.removeEventListener("keydown", onDocKeyDown, true);
    },
  };
}

/** Builds a sticky row-label cell. When `infoKey` is given, appends a small
 *  `.perio-info-btn` ("i" icon, real `aria-label`) after the label text that
 *  opens a positioned `.perio-info-popover` with `t(infoKey)` on click. */
export function mkRowLabelCell(text: string, infoKey?: string): HTMLDivElement {
  const cell = mkEl("div", "perio-fullgrid-row-label");
  const label = mkEl("span", "perio-fullgrid-row-label-text");
  label.textContent = text;
  cell.appendChild(label);
  if (infoKey) {
    const btn = mkEl("button", "perio-info-btn") as HTMLButtonElement;
    btn.type = "button";
    btn.textContent = "i";
    btn.setAttribute("aria-label", t("perio.info.button", { label: text }));
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleInfoPopover(infoKey, btn);
    });
    cell.appendChild(btn);
  }
  return cell;
}
