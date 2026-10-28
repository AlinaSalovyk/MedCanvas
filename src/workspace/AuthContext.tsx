import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const sessionRef = useRef<WorkspaceSession | null>(null);
  const [lang, setLang] = useState<WorkspaceLanguage>(() => getWorkspaceLanguage());
  const [session, setSessionState] = useState<WorkspaceSession | null>(null);

  // The token lives in memory only: a reload returns the user to the login page.
  const client = useMemo(
    () =>
      new MedCanvasApiClient({
        onUnauthorized: () => {
          queryClient.clear();
          sessionRef.current = null;
          setSessionState(null);
        },
      }),
    [queryClient]
  );

  const setSession = useCallback(
    (next: WorkspaceSession | null) => {
      if (sessionRef.current?.clinicId !== next?.clinicId || sessionRef.current?.userId !== next?.userId) {
        queryClient.clear();
      }
      sessionRef.current = next;
      setSessionState(next);
      if (next) {
        client.setToken(next.token);
      } else {
        client.setToken(null);
      }
    },
    [client, queryClient]
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
