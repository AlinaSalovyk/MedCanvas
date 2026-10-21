import { useCallback, type RefObject, type MutableRefObject } from "react";
import {
  type PerioSite,
  type PerioCellCoord,
  getReadOnly,
  setPerioSite,
  nextPerioCell,
  prevPerioCell,
} from "@/odontogram";
import type { ToothCellRefs } from "./types";

export function usePerioKeyboardNav({
  registryRef,
  suppressResyncRef,
  syncOneTooth,
}: {
  registryRef: RefObject<Map<number, ToothCellRefs> | null>;
  suppressResyncRef: MutableRefObject<boolean>;
  syncOneTooth: (toothNo: number) => void;
}) {
  const focusPerioCell = useCallback((coord: PerioCellCoord | null) => {
    if (!coord) return;
    const registry = registryRef.current;
    if (!registry) return;
    const cells = registry.get(coord.toothNo);
    if (!cells) return;
    const el = cells[coord.row][coord.site];
    if (el && !el.disabled) el.focus();
  }, [registryRef]);

  const handleGridKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (getReadOnly()) return;
      const target = e.target as HTMLElement | null;
      const coordStr = target?.dataset?.perio;
      if (!coordStr) return;
      const [toothStr, siteStr, rowStr] = coordStr.split(":");
      const toothNo = Number(toothStr);
      const site = siteStr as PerioSite;

      if (rowStr === "bop") {
        if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
          e.preventDefault();
          const checkbox = target as HTMLInputElement;
          const next = !checkbox.checked;
          suppressResyncRef.current = true;
          setPerioSite(toothNo, site, { bop: next });
          suppressResyncRef.current = false;
          syncOneTooth(toothNo);
        }
        return;
      }

      const row = rowStr as "pd" | "gm";
      const cur: PerioCellCoord = { toothNo, site, row };
      const input = target as HTMLInputElement;
      const isDigit = /^[0-9]$/.test(e.key);

      if (row === "gm" && input.dataset.pendingSign && e.key !== "-" && !isDigit) {
        delete input.dataset.pendingSign;
      }

      if (row === "pd" && input.dataset.pendingTens === "1") {
        if (/^[0-5]$/.test(e.key)) {
          e.preventDefault();
          delete input.dataset.pendingTens;
          suppressResyncRef.current = true;
          setPerioSite(toothNo, site, { pd: Number(`1${e.key}`) });
          suppressResyncRef.current = false;
          syncOneTooth(toothNo);
          focusPerioCell(nextPerioCell(cur));
          return;
        }
        delete input.dataset.pendingTens;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        focusPerioCell(nextPerioCell(cur));
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusPerioCell(prevPerioCell(cur));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        focusPerioCell({ toothNo, site, row: "pd" });
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        focusPerioCell({ toothNo, site, row: "gm" });
        return;
      }

      if (row === "gm" && e.key === "-") {
        e.preventDefault();
        input.dataset.pendingSign = "-";
        return;
      }

      if (isDigit) {
        e.preventDefault();
        if (row === "pd" && e.key === "1") {
          suppressResyncRef.current = true;
          setPerioSite(toothNo, site, { pd: 1 });
          suppressResyncRef.current = false;
          syncOneTooth(toothNo);
          input.dataset.pendingTens = "1";
          return;
        }
        suppressResyncRef.current = true;
        if (row === "pd") {
          setPerioSite(toothNo, site, { pd: Number(e.key) });
        } else {
          const composed = input.dataset.pendingSign === "-" ? `-${e.key}` : e.key;
          delete input.dataset.pendingSign;
          setPerioSite(toothNo, site, { gm: Number(composed) });
        }
        suppressResyncRef.current = false;
        syncOneTooth(toothNo);
        focusPerioCell(nextPerioCell(cur));
      }
    },
    [focusPerioCell, syncOneTooth, suppressResyncRef],
  );

  const handleGridFocusOut = useCallback((e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.dataset?.pendingSign) delete target.dataset.pendingSign;
    if (target?.dataset?.pendingTens) delete target.dataset.pendingTens;
  }, []);

  return { focusPerioCell, handleGridKeyDown, handleGridFocusOut };
}
