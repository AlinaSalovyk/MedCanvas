import type { Any } from "@/engine/types";

// ---- DOM helpers ----
// Deliberately untyped: call sites reach straight for .value, .checked, .dataset, etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const $ = (sel: string, el: ParentNode = document) => el.querySelector(sel) as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const $$ = (sel: string, el: ParentNode = document) => Array.from(el.querySelectorAll(sel)) as any[];

export function el(tag: Any, attrs: Any = {}, children: Any[] = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v as string;
    else if (k === "text") n.textContent = v as string;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v as EventListener);
    else n.setAttribute(k, v as string);
  }
  for (const c of children) n.appendChild(c);
  return n;
}

export function setActive(node: Any, on: Any) {
  if (!node) return;
  node.setAttribute("data-active", on ? "1" : "0");
}

export function stripDisplayNoneToDataActive(root: Any) {
  // Convert inline style display:none -> data-active=0, and remove display property from style.
  const nodes = $$("[id]", root);
  for (const n of nodes) {
    const style = n.getAttribute("style");
    if (style && /display\s*:\s*none/i.test(style)) {
      n.setAttribute("data-active", "0");
      // remove display: none; (and possible surrounding semicolons/spaces)
      const newStyle = style
        .replace(/display\s*:\s*none\s*;?/gi, "")
        .replace(/;;+/g, ";")
        .trim();
      if (newStyle) n.setAttribute("style", newStyle);
      else n.removeAttribute("style");
    }
  }
}

export function ensureDataActiveForSwitchables(root: Any) {
  // Every element that is inside these switchable groups and has an id should get data-active (default 0 if missing)
  const switchableGroups = ["mods", "tooth-variants", "endos", "surfaces", "restorations", "specials"];
  for (const gId of switchableGroups) {
    const g = root.getElementById ? root.getElementById(gId) : $("#" + gId, root);
    if (!g) continue;
    for (const n of $$("[id]", g)) {
      if (!n.hasAttribute("data-active")) n.setAttribute("data-active", "0");
    }
  }
  // Tooth base + pulps should also be consistent
  for (const id of [
    "tooth-base",
    "tooth-healthy-pulp",
    "tooth-inflam-pulp",
    "milktooth-base",
    "milktooth-beauty",
    "milktooth-healthy-pulp",
    "milktooth-inflam-pulp",
    "tooth-bruxism-wear",
    "tooth-bruxism-neck-wear",
  ]) {
    const n = $("#" + id, root);
    if (n && !n.hasAttribute("data-active")) n.setAttribute("data-active", "0");
  }
}

export function rotate180(svgRoot: Any) {
  // rotate around center using a wrapper group
  const vb = svgRoot.getAttribute("viewBox") || "0 0 32 64";
  const parts = vb.trim().split(/\s+/).map(Number);
  const cx = parts[0] + parts[2] / 2;
  const cy = parts[1] + parts[3] / 2;
  // wrap existing content into a new group
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  while (svgRoot.firstChild) {
    g.appendChild(svgRoot.firstChild);
  }
  g.setAttribute("transform", `rotate(180 ${cx} ${cy})`);
  svgRoot.appendChild(g);
}

export function mirrorVertical(svgRoot: Any) {
  // mirror vertically (left-right) around center using a wrapper group
  const vb = svgRoot.getAttribute("viewBox") || "0 0 32 64";
  const parts = vb.trim().split(/\s+/).map(Number);
  const cx = parts[0] + parts[2] / 2;
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  while (svgRoot.firstChild) {
    g.appendChild(svgRoot.firstChild);
  }
  g.setAttribute("transform", `scale(-1 1) translate(${-2 * cx} 0)`);
  svgRoot.appendChild(g);
}

export function svgGetById(root: Any, id: Any) {
  return root.getElementById ? root.getElementById(id) : $("#" + id, root);
}
