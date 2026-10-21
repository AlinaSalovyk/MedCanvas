import { useEffect, type RefObject, type MutableRefObject } from "react";
import {
  isToothImplant,
  getPerioToothKind,
  getPerioOverlayLayer,
  onStateChange,
  type ToothAnatomy,
} from "@/odontogram";
import {
  loadTemplateCache,
  buildBuccalArchSvg,
  buildPalatalArchSvg,
  type TemplateDocCache,
} from "@/perioGraphic";
import { UPPER_ARCH, LOWER_ARCH } from "./constants";
import { applyArchColumns } from "./buildArch";
import { drawArchCurves, drawArchOverlay } from "./archDraw";

export function usePerioGraphics({
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
}: {
  active: boolean;
  anatomy: ToothAnatomy;
  scrollRef: RefObject<HTMLDivElement | null>;
  buccalUpperRef: RefObject<HTMLDivElement | null>;
  palatalUpperRef: RefObject<HTMLDivElement | null>;
  buccalLowerRef: RefObject<HTMLDivElement | null>;
  palatalLowerRef: RefObject<HTMLDivElement | null>;
  gridUpperRef: RefObject<HTMLDivElement | null>;
  gridLowerRef: RefObject<HTMLDivElement | null>;
  archCacheRef: MutableRefObject<TemplateDocCache | null>;
}) {

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const implantSig = () =>
      [...UPPER_ARCH, ...LOWER_ARCH].filter((n) => isToothImplant(n)).join(",");
    let lastImplantSig: string | null = null;

    const buildArches = (cache: TemplateDocCache) => {
      const buccalUpper = buccalUpperRef.current;
      const palatalUpper = palatalUpperRef.current;
      const buccalLower = buccalLowerRef.current;
      const palatalLower = palatalLowerRef.current;
      if (buccalUpper) {
        buccalUpper.innerHTML = "";
        buccalUpper.appendChild(buildBuccalArchSvg(cache, UPPER_ARCH, isToothImplant, undefined, getPerioToothKind));
      }
      if (palatalUpper) {
        palatalUpper.innerHTML = "";
        palatalUpper.appendChild(buildPalatalArchSvg(cache, UPPER_ARCH, isToothImplant, undefined, getPerioToothKind));
      }
      if (buccalLower) {
        buccalLower.innerHTML = "";
        buccalLower.appendChild(buildBuccalArchSvg(cache, LOWER_ARCH, isToothImplant, undefined, getPerioToothKind));
      }
      if (palatalLower) {
        palatalLower.innerHTML = "";
        palatalLower.appendChild(buildPalatalArchSvg(cache, LOWER_ARCH, isToothImplant, undefined, getPerioToothKind));
      }
      lastImplantSig = implantSig();
    };

    const redraw = () => {
      const cache = archCacheRef.current;
      if (!cache) return;
      if (implantSig() !== lastImplantSig) buildArches(cache);
      drawArchCurves(cache, gridUpperRef.current, UPPER_ARCH);
      drawArchCurves(cache, gridLowerRef.current, LOWER_ARCH);
      const layer = getPerioOverlayLayer();
      drawArchOverlay(cache, gridUpperRef.current, UPPER_ARCH, layer);
      drawArchOverlay(cache, gridLowerRef.current, LOWER_ARCH, layer);
    };

    const fitColumns = () => {
      const cache = archCacheRef.current;
      if (!cache) return;
      try {
        applyArchColumns(gridUpperRef.current, UPPER_ARCH, cache, scrollRef.current);
        applyArchColumns(gridLowerRef.current, LOWER_ARCH, cache, scrollRef.current);
      } catch (e) {
        console.error("perio fitColumns failed", e);
      }
    };

    loadTemplateCache()
      .then((cache) => {
        if (cancelled) return;
        archCacheRef.current = cache;
        fitColumns();
        buildArches(cache);
        drawArchCurves(cache, gridUpperRef.current, UPPER_ARCH);
        drawArchCurves(cache, gridLowerRef.current, LOWER_ARCH);
        const layer = getPerioOverlayLayer();
        drawArchOverlay(cache, gridUpperRef.current, UPPER_ARCH, layer);
        drawArchOverlay(cache, gridLowerRef.current, LOWER_ARCH, layer);
      })
      .catch((err) => {
        console.error("perio tooth-row graphic: failed to load tooth templates", err);
      });

    const unsubscribe = onStateChange(() => {
      if (!cancelled) redraw();
    });

    let resizeObserver: ResizeObserver | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    if (typeof ResizeObserver !== "undefined" && scrollRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          resizeTimer = null;
          if (!cancelled) fitColumns();
        }, 100);
      });
      resizeObserver.observe(scrollRef.current);
    }

    return () => {
      cancelled = true;
      unsubscribe();
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      archCacheRef.current = null;
    };
  }, [
    active,
    anatomy,
    scrollRef,
    buccalUpperRef,
    palatalUpperRef,
    buccalLowerRef,
    palatalLowerRef,
    gridUpperRef,
    gridLowerRef,
  ]);

  return { archCacheRef };
}
