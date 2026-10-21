import { type OdontogramPlugin, getQuadrant, LAYER_Z } from "@/plugin";
import { sanitizePluginSvg } from "@/pluginSanitize";

export type PluginOverlayRegistry = Map<number, Map<string, Map<SVGElement, SVGGElement>>>;

export interface PluginOverlayContext {
  plugins: readonly OdontogramPlugin[];
  roots: SVGElement[] | undefined;
  state?: { customStates?: Record<string, unknown> } | null;
  overlays: PluginOverlayRegistry;
}

/**
 * Inserts a plugin's `<g>` container into the tooth SVG root at the appropriate
 * z-position based on its declared layer.
 *
 * Layer z-order:
 * base(0) < tooth(1) < endo(2) < restoration(3) < crown(4) < caries(5) < overlay(6)
 */
export function insertPluginGroup(svg: SVGElement, g: SVGGElement, layer: string): void {
  const z = LAYER_Z[layer as keyof typeof LAYER_Z] ?? 6;
  // Find the right insertion point based on layer order:
  // base(0) < tooth(1) < endo(2) < restoration(3) < crown(4) < caries(5) < overlay(6)
  // Plugin groups are appended; overlay goes last, base goes first.
  const existingPlugins = svg.querySelectorAll("g[data-plugin]");
  let inserted = false;
  for (const ep of existingPlugins) {
    const epLayer = ep.getAttribute("data-layer") || "overlay";
    const epZ = LAYER_Z[epLayer as keyof typeof LAYER_Z] ?? 6;
    if (epZ > z) {
      ep.parentElement?.insertBefore(g, ep);
      inserted = true;
      break;
    }
  }
  if (!inserted) {
    // For overlay: append at end. For base: insert before first child group.
    if (layer === "base" && svg.firstChild) {
      svg.insertBefore(g, svg.firstChild);
    } else {
      svg.appendChild(g);
    }
  }
}

/**
 * Renders SVG overlay groups for all registered plugins on the specified tooth.
 *
 * For each SVG root of the tooth:
 * 1. Tracks and replaces existing overlays independently per SVG root.
 * 2. Invokes plugin.renderSvg(toothNo, quadrant, customState) safely (skipping on throw).
 * 3. Sanitizes output via sanitizePluginSvg() before setting innerHTML.
 * 4. Inserts <g data-plugin data-layer> at the correct z-order on each root.
 * 5. Updates the per-tooth, per-plugin, per-root overlay map.
 */
export function applyPluginOverlays(
  toothNo: number,
  context: PluginOverlayContext,
): void {
  const { plugins, roots, state, overlays } = context;
  if (!plugins || plugins.length === 0) return;
  if (!roots || roots.length === 0) return;
  const quadrant = getQuadrant(toothNo);

  let toothPluginMap = overlays.get(toothNo);
  if (!toothPluginMap) {
    toothPluginMap = new Map();
    overlays.set(toothNo, toothPluginMap);
  }

  // Prune any plugins that were previously tracked for this tooth but are no longer active
  const activePluginIds = new Set(plugins.map((p) => p.id));
  for (const [pluginId, rootMap] of Array.from(toothPluginMap.entries())) {
    if (!activePluginIds.has(pluginId)) {
      for (const [_, g] of rootMap) {
        if (g.parentElement) g.remove();
      }
      toothPluginMap.delete(pluginId);
    }
  }

  for (const plugin of plugins) {
    let rootMap = toothPluginMap.get(plugin.id);
    if (!rootMap) {
      rootMap = new Map();
      toothPluginMap.set(plugin.id, rootMap);
    }

    // Prune references to roots that are no longer present in `roots`
    for (const [oldSvg, oldG] of Array.from(rootMap.entries())) {
      if (!roots.includes(oldSvg)) {
        if (oldG.parentElement) oldG.remove();
        rootMap.delete(oldSvg);
      }
    }

    const customState = state?.customStates?.[plugin.id];
    let svgContent: string | null | undefined;
    try {
      svgContent = plugin.renderSvg(toothNo, quadrant, customState);
    } catch (_e) {
      // Plugin render error — skip and remove existing overlays for this plugin on all roots
      for (const [_, existing] of rootMap) {
        if (existing.parentElement) existing.remove();
      }
      rootMap.clear();
      continue;
    }

    if (!svgContent) {
      // Empty/null output — remove existing overlays for this plugin on all roots
      for (const [_, existing] of rootMap) {
        if (existing.parentElement) existing.remove();
      }
      rootMap.clear();
      continue;
    }

    // Security: plugin output is third-party content — sanitize before the
    // innerHTML sink. An entirely-malicious fragment sanitizes to "" and the
    // overlay is skipped rather than inserted empty.
    const cleanSvg = sanitizePluginSvg(svgContent);
    if (!cleanSvg) {
      console.warn(
        `odontogram plugin "${plugin.id}": renderSvg() output was fully removed by sanitization — overlay skipped`,
      );
      for (const [_, existing] of rootMap) {
        if (existing.parentElement) existing.remove();
      }
      rootMap.clear();
      continue;
    }

    // Render onto each applicable SVG root independently
    for (const svg of roots) {
      // 1. Remove previous overlay for this plugin on THIS specific root
      const existing = rootMap.get(svg);
      if (existing && existing.parentElement) existing.remove();

      // 2. Extra safety: remove any stray child group on this root with matching data-plugin
      for (const child of Array.from(svg.children)) {
        if (child.tagName.toLowerCase() === "g" && child.getAttribute("data-plugin") === plugin.id) {
          child.remove();
        }
      }

      // 3. Create fresh namespaced group with plugin metadata
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("data-plugin", plugin.id);
      g.setAttribute("data-layer", plugin.layer);
      g.innerHTML = cleanSvg;

      // 4. Insert into SVG at the correct z-position based on layer
      insertPluginGroup(svg, g, plugin.layer);

      // 5. Register this root's overlay group
      rootMap.set(svg, g);
    }
  }
}
