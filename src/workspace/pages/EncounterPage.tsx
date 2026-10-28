import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OdontogramSyncBridge } from "../../api/odontogramSync";
import type { SyncStatus } from "../../api/odontogramSync";
import { destroyOdontogram } from "../../odontogram";
import { ApiError } from "../../api/client";
import { emptyClinicalSnapshot } from "../emptyClinicalSnapshot";
import { EncounterNavigationGuard, registerEncounterFlush } from "../encounterNavigation";
import App from "../../App";
import { PerformedProceduresPanel } from "./PerformedProceduresPanel";
import type { OdontogramResponseDto } from "../../api/types";
import { useAuth } from "../AuthContext";

/**
 * M04 clinical encounter workspace: hosts the real odontogram engine (frozen public
 * surface) wired through the M00-hardened sync bridge — autosave, truthful status
 * chip, conflict resolution, recovery lock screen, notes, and completion.
 */
export function EncounterPage(): ReactNode {
  const { session } = useAuth();
  const { id } = useParams<{ id: string }>();
  return <EncounterWorkspace key={`${session?.clinicId}:${id}`} />;
}

function EncounterWorkspace(): ReactNode {
  const { client, session, t } = useAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const bridgeRef = useRef<OdontogramSyncBridge | null>(null);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [statusError, setStatusError] = useState<Error | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverCopy, setServerCopy] = useState<OdontogramResponseDto | null>(null);
  const [completing, setCompleting] = useState(false);
  const [missingChart, setMissingChart] = useState(false);
  const [creatingChart, setCreatingChart] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => registerEncounterFlush(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (bridge.getStatus() === "recovery-required") throw new Error(t("sync.recovery"));
    setLeaving(true);
    try {
      while (bridge.hasUnsavedChanges()) await bridge.save("Save before leaving encounter");
    } finally {
      setLeaving(false);
    }
  }), [t]);

  const encounterQuery = useQuery({
    queryKey: ["encounter", session?.clinicId, id],
    queryFn: () => client.getEncounter(id!),
    enabled: Boolean(id),
  });

  const encounter = encounterQuery.data;
  const isFinished = Boolean(encounter && encounter.status !== "InProgress");

  const patientQuery = useQuery({
    queryKey: ["patient", session?.clinicId, encounter?.patientId],
    queryFn: () => client.getPatient(encounter!.patientId),
    enabled: Boolean(encounter?.patientId),
  });

  // Create the bridge once per encounter and hydrate the engine chart.
  useEffect(() => {
    if (!id || !encounter) return;
    let cancelled = false;
    const bridge = new OdontogramSyncBridge({
      client,
      encounterId: id,
      onStatusChange: (next, err) => {
        if (cancelled) return;
        setStatus(next);
        setStatusError(err ?? null);
      },
      onConflict: (server) => setServerCopy(server),
    });
    bridgeRef.current = bridge;

    bridge
      .load()
      .then(() => {
        if (cancelled) return;
        if (!isFinished) bridge.startAutoSync();
        setLoaded(true);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404 && !isFinished) {
          setMissingChart(true);
          setStatusError(null);
          return;
        }
        setLoadError(err.message);
        setStatus(bridge.getStatus());
      });

    return () => {
      cancelled = true;
      bridge.destroy();
      bridgeRef.current = null;
      // Engine hygiene: the module-scoped engine must not leak chart state between patients.
      destroyOdontogram();
    };
  }, [id, client, encounter?.id]);

  useEffect(() => {
    if (isFinished) bridgeRef.current?.stopAutoSync();
  }, [isFinished]);

  const createChart = async (): Promise<void> => {
    if (!id || creatingChart || isFinished) return;
    setCreatingChart(true);
    try {
      await client.saveOdontogram(id, { snapshotJson: emptyClinicalSnapshot(), changeSummary: "Initialize examination" });
      await bridgeRef.current?.load();
      bridgeRef.current?.startAutoSync();
      setMissingChart(false);
      setLoaded(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setCreatingChart(false);
    }
  };

  const resolveConflict = (): void => {
    setServerCopy(null);
    void bridgeRef.current
      ?.resolveConflictWithServerCopy()
      .catch((err: Error) => setLoadError(err.message));
  };

  const completeEncounter = async (): Promise<void> => {
    if (!id || completing) return;
    setCompleting(true);
    try {
      // Flush pending edits before sealing the encounter.
      if (bridgeRef.current?.hasUnsavedChanges()) {
        await bridgeRef.current.save("Final save before completing the encounter", { force: true });
      }
      await client.completeEncounter(id);
      void queryClient.invalidateQueries({ queryKey: ["encounter"] });
      void queryClient.invalidateQueries({ queryKey: ["patient-encounters"] });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setCompleting(false);
    }
  };

  if (encounterQuery.isLoading) {
    return (
      <section aria-live="polite">
        <p>{t("common.loading")}</p>
      </section>
    );
  }

  if (encounterQuery.isError || !encounter) {
    return (
      <section role="alert">
        <p className="ws-error-text">{t("encounters.notFound")}</p>
        <Link to="/calendar" className="ws-button">
          {t("calendar.title")}
        </Link>
      </section>
    );
  }

  const statusLabel: Record<string, string> = {
    idle: t("sync.idle"),
    loading: t("sync.loading"),
    saving: t("sync.saving"),
    saved: t("sync.saved"),
    conflict: t("sync.conflict"),
    error: t("sync.error"),
    "recovery-required": t("sync.recovery"),
  };

  return (
    <section className="ws-encounter">
      <EncounterNavigationGuard hasChanges={() => bridgeRef.current?.hasUnsavedChanges() ?? false} onError={setLoadError} />
      <div className="ws-page-header">
        <h1>
          {patientQuery.data?.fullName ?? t("encounters.title")}
          {patientQuery.data?.medicalAlerts && (
            <span className="ws-alerts-text"> · {patientQuery.data.medicalAlerts}</span>
          )}
        </h1>
        <span className={`ws-sync-chip ws-sync-${status}`} role="status" data-testid="sync-chip">
          {statusLabel[status] ?? status}
        </span>
        {!isFinished && (
          <button
            type="button"
            className="ws-button ws-button-primary"
            disabled={completing || status === "conflict" || status === "recovery-required"}
            onClick={() => void completeEncounter()}
          >
            {t("encounters.complete")}
          </button>
        )}
      </div>

      {statusError && !missingChart && status !== "conflict" && (
        <p className="ws-error-text" role="alert">
          {statusError.message}
        </p>
      )}

      {loadError && (
        <p className="ws-error-text" role="alert">
          {loadError}
        </p>
      )}

      {isFinished && (
        <div className="ws-card ws-finished-note" role="status">
          {t("encounters.finished").replace("{{status}}", t(`patients.encounterStatus.${encounter.status}`))}
        </div>
      )}

      {serverCopy && (
        <div className="ws-modal-backdrop" role="dialog" aria-modal="true" aria-label={t("sync.conflict")}>
          <div className="ws-modal ws-card">
            <h2>{t("sync.conflict")}</h2>
            <p>{t("sync.conflictBody")}</p>
            <div className="ws-form-actions">
              <button type="button" className="ws-button ws-button-danger" onClick={resolveConflict}>
                {t("sync.takeServerCopy")}
              </button>
              <button type="button" className="ws-button" onClick={() => setServerCopy(null)}>
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {missingChart && <button type="button" className="ws-button ws-button-primary" disabled={creatingChart} onClick={() => void createChart()}>{t("encounters.initializeChart")}</button>}
      {!loaded && !missingChart && <p aria-live="polite">{t("common.loading")}</p>}
      <div className="ws-encounter-engine" style={{ display: loaded ? undefined : "none" }}>
        <App enableNotes readOnly={!loaded || isFinished || completing || leaving} />
      </div>
      {loaded && !isFinished && <PerformedProceduresPanel encounterId={encounter.id} />}
    </section>
  );
}
