import { fmt, MM_LABEL_X, PERIO_MM_GRID_MAX, SVG_NS } from "./constants";

/**
 * Build the background mm-grid layer for ONE row: faint horizontal guide lines
 * every 1 mm below the CEJ baseline toward the root (`y = cejY + n*mmPx`, n =
 * 1..maxMm), with every 5th line emphasized (`perio-mm-line-major`) and given a
 * small numeric label ("5"/"10"/"15"). Pure DOM (jsdom in tests / the browser
 * at runtime) — no perio-module call, so it is trivially unit-testable and
 * parity-irrelevant (brand-new DOM, never near the live odontogram).
 *
 * The grid is drawn in the SAME row-local coordinate space as the teeth and the
 * curve (crown up = smaller y, root down = larger y; shared CEJ baseline at
 * `cejY`), so a line at "n mm from the CEJ" lands EXACTLY where an n-mm (gm=0)
 * pocket's curve point lands (`perioCurve` → `pocketY = cejY + n*mmPx`). The
 * caller appends it INTO the SAME oriented/mirrored row group as the teeth
 * (`.perio-tooth-row-buccal` / `.perio-tooth-row-palatal-inner`), so the
 * per-arch flip carries the grid along with the teeth — the mm lines stay on the
 * ROOT side of the CEJ (away from the occlusal mid-line) on both arches.
 *
 * `flip`: when the containing row group is NET vertically flipped on screen
 * (the upper arch's crown-down buccal row, or the lower arch's mirrored palatal
 * row), the numeric labels would render upside-down. Passing `flip: true`
 * counter-flips each label about its own baseline (`matrix(1 0 0 -1 0 2y)`) so
 * the digits read upright regardless of the row's orientation — the LINES,
 * being horizontal, are unaffected either way.
 *
 * The whole `<g>` is `aria-hidden` — a decorative measurement guide; the
 * accessible data lives in the number cells/summary alongside the graphic.
 */
export function buildMmGridLayer(opts: {
  cejY: number;
  mmPx: number;
  width: number;
  maxMm?: number;
  flip?: boolean;
}): SVGGElement {
  const { cejY, mmPx, width } = opts;
  const maxMm = opts.maxMm ?? PERIO_MM_GRID_MAX;
  const flip = opts.flip ?? false;

  const g = document.createElementNS(SVG_NS, "g") as unknown as SVGGElement;
  g.setAttribute("class", "perio-mm-grid");
  g.setAttribute("aria-hidden", "true");

  for (let n = 1; n <= maxMm; n++) {
    const y = cejY + n * mmPx;
    const major = n % 5 === 0;

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("class", major ? "perio-mm-line perio-mm-line-major" : "perio-mm-line perio-mm-line-minor");
    line.setAttribute("data-mm", String(n));
    line.setAttribute("x1", "0");
    line.setAttribute("y1", fmt(y));
    line.setAttribute("x2", fmt(width));
    line.setAttribute("y2", fmt(y));
    g.appendChild(line);

    if (major) {
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("class", "perio-mm-label");
      label.setAttribute("data-mm", String(n));
      label.setAttribute("x", fmt(MM_LABEL_X));
      label.setAttribute("y", fmt(y));
      // Counter-flip about the label's own baseline so the digits read upright
      // inside a net-flipped row group (see the doc comment). Horizontal lines
      // need no such correction.
      if (flip) label.setAttribute("transform", `matrix(1 0 0 -1 0 ${fmt(2 * y)})`);
      label.textContent = String(n);
      g.appendChild(label);
    }
  }

  return g;
}
