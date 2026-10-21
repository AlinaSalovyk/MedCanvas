import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  getPerioChart,
  getToothPerio,
  getToothCal,
  getPerioSummary,
  setPerioSite,
  setToothMobility,
  setFurcation,
  getToothFurcation,
  setPlaque,
  getToothPlaque,
  setCejVisibility,
  getCejVisibility,
  setRootConcavity,
  getRootConcavity,
  getPlaqueIndex,
  setPlaqueIndex,
  getGingivalIndex,
  setGingivalIndex,
  getPeriImplantPlaque,
  setPeriImplantPlaque,
  getPeriImplantBleeding,
  setPeriImplantBleeding,
  setKeratinizedWidth,
  getGingivalThickness,
  setGingivalThickness,
  getMillerClass,
  setMillerClass,
  getReadOnly,
  onStateChange,
  getPerioRowVisibility,
  getPerioIndexNameMode,
  isToothImplant,
  getPerioToothKind,
  getPerioOverlayLayer,
} from "@/odontogram";
import {
  buildBuccalArchSvg,
  buildPalatalArchSvg,
  type TemplateDocCache,
} from "@/perioGraphic";
import {
  UPPER_ARCH,
  LOWER_ARCH,
  EMPTY_PERIO,
  EMPTY_SUMMARY,
  CEJ_VISIBILITY_CYCLE,
  ROOT_CONCAVITY_CYCLE,
  GINGIVAL_THICKNESS_CYCLE,
  MILLER_CLASS_CYCLE,
} from "./constants";
import { hideInfoPopover } from "./popover";
import { syncToothCells } from "./syncCells";
import { buildArch, applyArchColumns } from "./buildArch";
import { drawArchCurves, drawArchOverlay } from "./archDraw";
import { usePerioKeyboardNav } from "./usePerioKeyboardNav";
import type { ToothCellRefs, GridHandlers, PerioSummaryData } from "./types";

export function usePerioGrid({
  active,
  scrollRef,
  archCacheRef,
}: {
  active: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  archCacheRef: RefObject<TemplateDocCache | null>;
}) {
  const buccalUpperRef = useRef<HTMLDivElement | null>(null);
  const palatalUpperRef = useRef<HTMLDivElement | null>(null);
  const buccalLowerRef = useRef<HTMLDivElement | null>(null);
  const palatalLowerRef = useRef<HTMLDivElement | null>(null);
  const gridUpperRef = useRef<HTMLDivElement | null>(null);
  const gridLowerRef = useRef<HTMLDivElement | null>(null);
  const registryRef = useRef<Map<number, ToothCellRefs> | null>(null);
  const suppressResyncRef = useRef(false);

  const [summary, setSummary] = useState<PerioSummaryData>(EMPTY_SUMMARY);

  const fullResync = useCallback(() => {
    const registry = registryRef.current;
    if (!registry) return;
    const chart = getPerioChart();
    const readOnly = getReadOnly();
    for (const [toothNo, cells] of registry) {
      const perio = chart[String(toothNo)] ?? EMPTY_PERIO;
      syncToothCells(cells, toothNo, perio, getToothCal(toothNo), readOnly);
    }
    setSummary(getPerioSummary());
  }, []);

  const syncOneTooth = useCallback((toothNo: number) => {
    const registry = registryRef.current;
    if (!registry) return;
    const cells = registry.get(toothNo);
    if (!cells) return;
    syncToothCells(cells, toothNo, getToothPerio(toothNo), getToothCal(toothNo), getReadOnly());
    setSummary(getPerioSummary());
  }, []);

  const { handleGridKeyDown, handleGridFocusOut } = usePerioKeyboardNav({
    registryRef,
    suppressResyncRef,
    syncOneTooth,
  });

  useEffect(() => {
    if (!active) return;
    const container = scrollRef.current;
    if (!container) return;

    const handlers: GridHandlers = {
      onPd: (toothNo, site, raw) => {
        const trimmed = raw.trim();
        suppressResyncRef.current = true;
        setPerioSite(toothNo, site, { pd: trimmed === "" ? null : Number(trimmed) });
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onGm: (toothNo, site, raw) => {
        const trimmed = raw.trim();
        if (trimmed === "") return;
        suppressResyncRef.current = true;
        setPerioSite(toothNo, site, { gm: Number(trimmed) });
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onBop: (toothNo, site, checked) => {
        suppressResyncRef.current = true;
        setPerioSite(toothNo, site, { bop: checked });
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onMobility: (toothNo, value) => {
        suppressResyncRef.current = true;
        setToothMobility(toothNo, value);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onFurcation: (toothNo, entrance) => {
        const cur = getToothFurcation(toothNo)[entrance];
        const next = cur === undefined ? 1 : cur >= 4 ? null : cur + 1;
        suppressResyncRef.current = true;
        setFurcation(toothNo, entrance, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onPlaque: (toothNo, surface) => {
        const present = getToothPlaque(toothNo).includes(surface);
        suppressResyncRef.current = true;
        setPlaque(toothNo, surface, !present);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onCejVisibility: (toothNo) => {
        const cur = getCejVisibility(toothNo);
        const idx = CEJ_VISIBILITY_CYCLE.indexOf(cur);
        const next = CEJ_VISIBILITY_CYCLE[(idx + 1) % CEJ_VISIBILITY_CYCLE.length];
        suppressResyncRef.current = true;
        setCejVisibility(toothNo, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onRootConcavity: (toothNo) => {
        const cur = getRootConcavity(toothNo);
        const idx = ROOT_CONCAVITY_CYCLE.indexOf(cur);
        const next = ROOT_CONCAVITY_CYCLE[(idx + 1) % ROOT_CONCAVITY_CYCLE.length];
        suppressResyncRef.current = true;
        setRootConcavity(toothNo, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onPiSurface: (toothNo, surface) => {
        const next = ((getPlaqueIndex(toothNo, surface) + 1) % 4) as 0 | 1 | 2 | 3;
        suppressResyncRef.current = true;
        setPlaqueIndex(toothNo, surface, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onGiSurface: (toothNo, surface) => {
        const next = ((getGingivalIndex(toothNo, surface) + 1) % 4) as 0 | 1 | 2 | 3;
        suppressResyncRef.current = true;
        setGingivalIndex(toothNo, surface, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onMpiSurface: (toothNo, surface) => {
        const next = ((getPeriImplantPlaque(toothNo, surface) + 1) % 4) as 0 | 1 | 2 | 3;
        suppressResyncRef.current = true;
        setPeriImplantPlaque(toothNo, surface, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onMbiSurface: (toothNo, surface) => {
        const next = ((getPeriImplantBleeding(toothNo, surface) + 1) % 4) as 0 | 1 | 2 | 3;
        suppressResyncRef.current = true;
        setPeriImplantBleeding(toothNo, surface, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onKg: (toothNo, raw) => {
        const trimmed = raw.trim();
        suppressResyncRef.current = true;
        setKeratinizedWidth(toothNo, trimmed === "" ? null : Number(trimmed));
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onGingivalThickness: (toothNo) => {
        const cur = getGingivalThickness(toothNo);
        const idx = GINGIVAL_THICKNESS_CYCLE.indexOf(cur);
        const next = GINGIVAL_THICKNESS_CYCLE[(idx + 1) % GINGIVAL_THICKNESS_CYCLE.length];
        suppressResyncRef.current = true;
        setGingivalThickness(toothNo, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
      onMillerClass: (toothNo) => {
        const cur = getMillerClass(toothNo);
        const idx = MILLER_CLASS_CYCLE.indexOf(cur);
        const next = MILLER_CLASS_CYCLE[(idx + 1) % MILLER_CLASS_CYCLE.length];
        suppressResyncRef.current = true;
        setMillerClass(toothNo, next);
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
      },
    };

    const visibilitySig = () => JSON.stringify([
      getPerioRowVisibility(),
      getPerioIndexNameMode(),
      [...UPPER_ARCH, ...LOWER_ARCH].filter((n) => isToothImplant(n)).join(","),
    ]);
    let lastVisibilitySig: string | null = null;

    const buildGrid = () => {
      const registry = new Map<number, ToothCellRefs>();
      container.innerHTML = "";
      const upper = buildArch(UPPER_ARCH, registry, handlers);
      const lower = buildArch(LOWER_ARCH, registry, handlers);
      container.appendChild(upper.grid);
      container.appendChild(lower.grid);
      registryRef.current = registry;
      gridUpperRef.current = upper.grid;
      gridLowerRef.current = lower.grid;
      buccalUpperRef.current = upper.buccalCell;
      palatalUpperRef.current = upper.palatalCell;
      buccalLowerRef.current = lower.buccalCell;
      palatalLowerRef.current = lower.palatalCell;
      lastVisibilitySig = visibilitySig();

      const cache = archCacheRef.current;
      if (cache) {
        applyArchColumns(gridUpperRef.current, UPPER_ARCH, cache, scrollRef.current);
        applyArchColumns(gridLowerRef.current, LOWER_ARCH, cache, scrollRef.current);
        buccalUpperRef.current.appendChild(buildBuccalArchSvg(cache, UPPER_ARCH, isToothImplant, undefined, getPerioToothKind));
        palatalUpperRef.current.appendChild(buildPalatalArchSvg(cache, UPPER_ARCH, isToothImplant, undefined, getPerioToothKind));
        buccalLowerRef.current.appendChild(buildBuccalArchSvg(cache, LOWER_ARCH, isToothImplant, undefined, getPerioToothKind));
        palatalLowerRef.current.appendChild(buildPalatalArchSvg(cache, LOWER_ARCH, isToothImplant, undefined, getPerioToothKind));
        drawArchCurves(cache, gridUpperRef.current, UPPER_ARCH);
        drawArchCurves(cache, gridLowerRef.current, LOWER_ARCH);
        const layer = getPerioOverlayLayer();
        drawArchOverlay(cache, gridUpperRef.current, UPPER_ARCH, layer);
        drawArchOverlay(cache, gridLowerRef.current, LOWER_ARCH, layer);
      }
    };

    buildGrid();
    fullResync();
    container.addEventListener("keydown", handleGridKeyDown);
    container.addEventListener("focusout", handleGridFocusOut);

    const unsubscribe = onStateChange(() => {
      if (suppressResyncRef.current) return;
      if (visibilitySig() !== lastVisibilitySig) buildGrid();
      fullResync();
    });

    return () => {
      container.removeEventListener("keydown", handleGridKeyDown);
      container.removeEventListener("focusout", handleGridFocusOut);
      unsubscribe();
      hideInfoPopover();
      registryRef.current = null;
      gridUpperRef.current = null;
      gridLowerRef.current = null;
      buccalUpperRef.current = null;
      palatalUpperRef.current = null;
      buccalLowerRef.current = null;
      palatalLowerRef.current = null;
    };
  }, [active, fullResync, syncOneTooth, handleGridKeyDown, handleGridFocusOut, scrollRef, archCacheRef]);

  return {
    summary,
    buccalUpperRef,
    palatalUpperRef,
    buccalLowerRef,
    palatalLowerRef,
    gridUpperRef,
    gridLowerRef,
  };
}
