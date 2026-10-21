import React from "react";
import { useOdontogramUi } from "@/OdontogramContext";
import OdontogramTopbar from "@/surfaces/OdontogramTopbar";
import OdontogramChartSurface from "@/surfaces/OdontogramChartSurface";
import ToothInfoSurface from "@/surfaces/ToothInfoSurface";
import ToothControlsSurface from "@/surfaces/ToothControlsSurface";
import PerioChart from "@/PerioChart";
import PerioSidebar from "@/PerioSidebar";
import { PerioLaunchBar } from "./PerioLaunchBar";
import { AppModals } from "./AppModals";

/**
 * The default shell layout: the four surfaces plus the shell-managed layout
 * wrappers, perio bits, and modals. Reads everything from the provider via
 * {@link useOdontogramUi}; holds no state of its own.
 */
export function ShellLayout(): React.ReactElement {
  const { isPerioView } = useOdontogramUi();

  return (
    <>
      <OdontogramTopbar />

      <main className="layout">
        <PerioLaunchBar />

        {/* Unmount the odontogram column while the perio (Dental Chart) view is
            active. Composable-UI Tier 2 made control wiring re-runnable, so the
            column can remount cleanly (OdontogramChartSurface re-runs
            rewireControls()/rebuildGrid() on mount) instead of being hidden. */}
        {!isPerioView && (
          <div className="chart-column">
            <OdontogramChartSurface />
            <ToothInfoSurface />
          </div>
        )}
        {isPerioView && (
          <div className="dental-chart-column" dir="ltr">
            <PerioChart inline />
          </div>
        )}
        <aside className="panel">
          {/* One region, two mutually-exclusive contents: the perio-context
              sidebar in the perio view, the odontogram control panel otherwise.
              ToothControlsSurface can now unmount/remount safely — it re-runs
              rewireControls() on mount (Tier 2) — so it is a plain conditional. */}
          {isPerioView ? <PerioSidebar /> : <ToothControlsSurface />}
        </aside>
      </main>

      <AppModals />
    </>
  );
}
