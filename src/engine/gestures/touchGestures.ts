import { readOnly } from "@/engine/displayGlobals";
import { el } from "@/engine/domHelpers";
import { t } from "@/i18n/useI18n";

// ---- Touch state ----
export const isTouchDevice = (): boolean => window.matchMedia("(pointer: coarse)").matches;

let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
export const LONG_PRESS_MS = 500;
export const TOUCH_MOVE_THRESHOLD = 10;

// Pinch state
let pinchStartDist = 0;
let pinchScale = 1;
let isPinching = false;

// Arch toggle state
let archMode: "both" | "upper" | "lower" = "both";
let archToggleBar: HTMLElement | null = null;

// ---- Touch: Pinch-to-zoom ----
export function getTouchDist(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

export function onGridTouchStart(e: TouchEvent): void {
  if (e.touches.length === 2) {
    isPinching = true;
    pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
    const grid = document.querySelector("#toothGrid") as HTMLElement | null;
    if (grid) grid.classList.add("odon-pinch-active");
    e.preventDefault();
  }
}

export function onGridTouchMove(e: TouchEvent): void {
  if (isPinching && e.touches.length === 2) {
    const dist = getTouchDist(e.touches[0], e.touches[1]);
    const scale = Math.max(0.5, Math.min(3, (dist / pinchStartDist) * pinchScale));
    const grid = document.querySelector("#toothGrid") as HTMLElement | null;
    if (grid) grid.style.transform = `scale(${scale})`;
    e.preventDefault();
  }
}

export function onGridTouchEnd(e: TouchEvent): void {
  if (isPinching && e.touches.length < 2) {
    isPinching = false;
    const grid = document.querySelector("#toothGrid") as HTMLElement | null;
    if (grid) {
      // Read current scale from transform
      const match = grid.style.transform.match(/scale\(([\d.]+)\)/);
      pinchScale = match ? parseFloat(match[1]) : 1;
      // Snap back to 1 if close
      if (pinchScale > 0.9 && pinchScale < 1.1) {
        pinchScale = 1;
        grid.style.transform = "";
        grid.classList.remove("odon-pinch-active");
      }
    }
  }
}

// ---- Touch: Arch toggle bar ----
export function buildArchToggle(): void {
  const grid = document.querySelector("#toothGrid") as HTMLElement | null;
  if (!grid) return;
  // Remove existing
  if (archToggleBar) archToggleBar.remove();

  archToggleBar = el("div", { class: "odon-arch-toggle" });
  const btnUpper = el("button", { class: "odon-arch-btn", text: t("touch.arch.upper") });
  const btnLower = el("button", { class: "odon-arch-btn", text: t("touch.arch.lower") });
  const btnBoth = el("button", { class: "odon-arch-btn active", text: t("touch.arch.both") });

  function setArch(mode: "both" | "upper" | "lower") {
    archMode = mode;
    btnUpper.classList.toggle("active", mode === "upper");
    btnLower.classList.toggle("active", mode === "lower");
    btnBoth.classList.toggle("active", mode === "both");
    grid!.classList.toggle("odon-arch-upper", mode === "upper");
    grid!.classList.toggle("odon-arch-lower", mode === "lower");
  }

  btnUpper.addEventListener("click", () => setArch(archMode === "upper" ? "both" : "upper"));
  btnLower.addEventListener("click", () => setArch(archMode === "lower" ? "both" : "lower"));
  btnBoth.addEventListener("click", () => setArch("both"));

  archToggleBar.appendChild(btnUpper);
  archToggleBar.appendChild(btnBoth);
  archToggleBar.appendChild(btnLower);

  // Insert before the grid
  grid.parentElement?.insertBefore(archToggleBar, grid);
}

export function refreshArchToggleLabels(): void {
  if (!archToggleBar) return;
  const btns = archToggleBar.querySelectorAll(".odon-arch-btn");
  if (btns[0]) btns[0].textContent = t("touch.arch.upper");
  if (btns[1]) btns[1].textContent = t("touch.arch.both");
  if (btns[2]) btns[2].textContent = t("touch.arch.lower");
}

// ---- Touch: tile event wiring ----
export interface TileTouchCallbacks {
  onShortTap?: (toothNo: number) => void;
  onLongPress?: (toothNo: number, touch: Touch) => void;
}

export function addTouchToTile(
  tile: HTMLElement,
  toothNo: number,
  callbacks?: TileTouchCallbacks,
): void {
  tile.addEventListener("touchstart", (e: TouchEvent) => {
    if (readOnly) return;
    if (e.touches.length !== 1) return;
    touchStartTime = Date.now();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchMoved = false;

    const touch = e.touches[0];
    longPressTimer = setTimeout(() => {
      if (!touchMoved) {
        callbacks?.onLongPress?.(toothNo, touch);
      }
    }, LONG_PRESS_MS);
  }, { passive: true });

  tile.addEventListener("touchmove", (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;
    if (Math.abs(dx) > TOUCH_MOVE_THRESHOLD || Math.abs(dy) > TOUCH_MOVE_THRESHOLD) {
      touchMoved = true;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
  }, { passive: true });

  tile.addEventListener("touchend", (e: TouchEvent) => {
    if (readOnly) return;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    const elapsed = Date.now() - touchStartTime;
    if (!touchMoved && elapsed < LONG_PRESS_MS) {
      // Short tap — show zoom popover on touch devices
      e.preventDefault(); // prevent click from also firing
      callbacks?.onShortTap?.(toothNo);
    }
  });
}

// ---- Teardown & Reset ----
export function resetTouchState(): void {
  if (archToggleBar) { archToggleBar.remove(); archToggleBar = null; }
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  pinchScale = 1;
  isPinching = false;
  pinchStartDist = 0;
  archMode = "both";
  touchMoved = false;
  touchStartTime = 0;
  touchStartX = 0;
  touchStartY = 0;
}

export function destroyTouchGestures(grid?: HTMLElement | null): void {
  if (grid) {
    grid.removeEventListener("touchstart", onGridTouchStart);
    grid.removeEventListener("touchmove", onGridTouchMove);
    grid.removeEventListener("touchend", onGridTouchEnd);
    grid.style.transform = "";
    grid.classList.remove("odon-pinch-active", "odon-arch-upper", "odon-arch-lower");
  }
  resetTouchState();
}

// Inspection getters for testing
export function getPinchScale(): number {
  return pinchScale;
}

export function getArchMode(): "both" | "upper" | "lower" {
  return archMode;
}

export function getArchToggleBar(): HTMLElement | null {
  return archToggleBar;
}
