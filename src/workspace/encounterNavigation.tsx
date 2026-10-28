import { useContext, useEffect, useRef } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";

let activeFlush: (() => Promise<void>) | null = null;

export function registerEncounterFlush(flush: () => Promise<void>): () => void {
  activeFlush = flush;
  return () => { if (activeFlush === flush) activeFlush = null; };
}

export async function flushActiveEncounter(): Promise<void> {
  await activeFlush?.();
}

/** Routes, browser back/forward, clinic switching and logout share the same
 * save-before-leave boundary. A failed save leaves the patient and route intact. */
export function EncounterNavigationGuard({ hasChanges, onError }: {
  hasChanges: () => boolean;
  onError: (message: string) => void;
}): React.ReactNode {
  const router = useContext(UNSAFE_DataRouterContext);
  return router ? <DataNavigationGuard hasChanges={hasChanges} onError={onError} /> : null;
}

function DataNavigationGuard({ hasChanges, onError }: {
  hasChanges: () => boolean;
  onError: (message: string) => void;
}): null {
  const blocker = useBlocker(hasChanges);
  const flushing = useRef(false);
  useEffect(() => {
    if (blocker.state !== "blocked" || flushing.current) return;
    flushing.current = true;
    void flushActiveEncounter().then(() => blocker.proceed()).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : "Could not save the examination.");
      blocker.reset();
    }).finally(() => { flushing.current = false; });
  }, [blocker, onError]);
  return null;
}
