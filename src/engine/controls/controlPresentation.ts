import { t } from "@/i18n/useI18n";
import type { Any } from "@/engine/types";

// `data-icon-src` carries inlined SVG markup (from a `?raw` import in App.tsx),
// parsed directly — never fetched — so inline icons ship inside the JS bundle.
export async function loadInlineIcon(button: Any){
  if(!button) return;
  const src = button.dataset.iconSrc;
  if(!src) return;
  try{
    const parser = new DOMParser();
    const doc = parser.parseFromString(src, "image/svg+xml");
    const svg = doc.documentElement;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.classList.add("icon-svg");
    button.innerHTML = "";
    button.appendChild(svg);
  }catch(_e){
    // ignore icon parse failures
  }
}

export function syncIconXLine(button: Any){
  if(!button || !button.dataset.xline) return;
  const pressed = button.getAttribute("aria-pressed") === "true";
  const line = button.querySelector("#x-line");
  if(line) line.style.display = pressed ? "none" : "";
}

export function getControlLabel(control: Any){
  if(!control) return null;
  const wrapped = control.closest ? control.closest("label") : null;
  if(wrapped) return wrapped;
  if(control.id){
    return document.querySelector(`label[for="${control.id}"]`);
  }
  return null;
}

export function syncControlLabelVisibility(control: Any){
  const label = getControlLabel(control);
  if(!label) return;
  label.style.display = control.disabled ? "none" : "";
}

export function setDisabled(control: Any, disabled: Any){
  if(!control) return;
  control.disabled = !!disabled;
  syncControlLabelVisibility(control);
}

export function setToggleButton(btn: Any, on: Any){
  if(!btn) return;
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  syncIconXLine(btn);
}

export function getToggleLabel(labelKey: Any, collapsed: Any){
  return t(collapsed ? "actions.expand" : "actions.collapse", { label: t(labelKey) });
}

export function applyToggleA11y(btn: Any, labelKey: Any, collapsed: Any){
  if(!btn) return;
  const text = getToggleLabel(labelKey, collapsed);
  btn.setAttribute("title", text);
  btn.setAttribute("aria-label", text);
}
