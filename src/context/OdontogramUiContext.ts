import { createContext, useContext } from "react";
import type { OdontogramUiContextValue } from "./types";

export const OdontogramUiContext = createContext<OdontogramUiContextValue | null>(null);

/**
 * Read the shared odontogram UI context. Throws when used outside an
 * `<OdontogramProvider>`, so a misplaced surface fails loudly at mount.
 */
export function useOdontogramUi(): OdontogramUiContextValue {
  const ctx = useContext(OdontogramUiContext);
  if (ctx === null) {
    throw new Error("useOdontogramUi must be used within an <OdontogramProvider>.");
  }
  return ctx;
}
