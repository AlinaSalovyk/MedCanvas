import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { MedCanvasApiClient } from "../api/client";
import type { CurrentUserResponse } from "../api/types";
import { getWorkspaceLanguage, setWorkspaceLanguage, workspaceT } from "./i18n";
import type { WorkspaceLanguage } from "./i18n";

export interface WorkspaceSession {
  token: string;
  userId: string;
  fullName: string;
  email: string;
  clinicId: string;
  clinicName: string;
  role: string;
}

interface AuthContextValue {
  client: MedCanvasApiClient;
  session: WorkspaceSession | null;
  setSession: (session: WorkspaceSession | null) => void;
  logout: () => void;
  lang: WorkspaceLanguage;
  t: (key: string) => string;
  switchLang: (lang: WorkspaceLanguage) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [lang, setLang] = useState<WorkspaceLanguage>(() => getWorkspaceLanguage());
  const [session, setSessionState] = useState<WorkspaceSession | null>(null);

  // The token lives in memory only: a reload returns the user to the login page.
  const client = useMemo(
    () =>
      new MedCanvasApiClient({
        onUnauthorized: () => {
          setSessionState(null);
        },
      }),
    []
  );

  const setSession = useCallback(
    (next: WorkspaceSession | null) => {
      setSessionState(next);
      if (next) {
        client.setToken(next.token);
      } else {
        client.setToken(null);
      }
    },
    [client]
  );

  const logout = useCallback(() => setSession(null), [setSession]);

  const t = useCallback((key: string) => workspaceT(lang, key), [lang]);

  const switchLang = useCallback((next: WorkspaceLanguage) => {
    setWorkspaceLanguage(next);
    setLang(next);
  }, []);

  const value = useMemo(
    () => ({ client, session, setSession, logout, lang, t, switchLang }),
    [client, session, setSession, logout, lang, t, switchLang]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function sessionFromUser(token: string, user: CurrentUserResponse, clinicName: string): WorkspaceSession {
  return {
    token,
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    clinicId: user.clinicId,
    clinicName,
    role: user.role,
  };
}
