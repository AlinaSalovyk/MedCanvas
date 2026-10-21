import React from "react";
import {
  closePerioOverlay,
  acceptDualStateConfirm,
  cancelDualStateConfirm,
} from "@/odontogram";
import { useOdontogramUi } from "@/OdontogramContext";
import SettingsModal from "@/SettingsModal";
import PerioChart from "@/PerioChart";
import DualStateConfirm from "@/DualStateConfirm";
import ExportOptionsModal from "@/ExportOptionsModal";
import CaseDiagnosesModal from "@/CaseDiagnosesModal";

/**
 * Shell-level modals and overlay containers.
 */
export function AppModals(): React.ReactElement {
  const {
    t,
    viewMode,
    perioOpen,
    confirmOpen,
    settingsState,
    settingsOpen,
    setSettingsOpen,
    pdfOpen,
    setPdfOpen,
    caseDxOpen,
    setCaseDxOpen,
  } = useOdontogramUi();

  return (
    <>
      {viewMode === "popup" && <PerioChart open={perioOpen} onClose={closePerioOverlay} />}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        t={t}
        settings={settingsState}
      />

      <DualStateConfirm
        open={confirmOpen}
        t={t}
        onAccept={acceptDualStateConfirm}
        onCancel={cancelDualStateConfirm}
      />

      <ExportOptionsModal
        open={pdfOpen}
        t={t}
        onClose={() => setPdfOpen(false)}
      />
      <CaseDiagnosesModal
        open={caseDxOpen}
        t={t}
        onClose={() => setCaseDxOpen(false)}
      />
    </>
  );
}
