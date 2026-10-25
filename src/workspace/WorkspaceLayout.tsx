import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";

/**
 * Authenticated workspace shell: topbar with clinic identity/switcher and the
 * role-aware primary navigation. Only implemented modules appear in the nav —
 * patients/calendar/etc. join in later MVP modules.
 */
export function WorkspaceLayout(): ReactNode {
  const { session, logout, client, setSession, t, lang, switchLang } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const { data: clinics } = useQuery({
    queryKey: ["my-clinics", session?.userId],
    queryFn: () => client.getMyClinics(),
    enabled: Boolean(session),
  });

  if (!session) {
    return null;
  }

  const alternatives = (clinics ?? []).filter((c) => c.clinicId !== session.clinicId);

  const handleSwitch = async (clinicId: string): Promise<void> => {
    setSwitching(true);
    setSwitchError(null);
    try {
      const result = await client.switchClinic(clinicId);
      if (result.token && result.clinicId) {
        // Tenant boundary: drop every cached query from the previous clinic.
        queryClient.clear();
        setSession({
          token: result.token,
          userId: result.userId ?? session.userId,
          fullName: result.fullName ?? session.fullName,
          email: result.email ?? session.email,
          clinicId: result.clinicId,
          clinicName: result.clinicName ?? clinicId,
          role: result.role ?? session.role,
        });
      }
    } catch {
      setSwitchError(t("common.error"));
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = (): void => {
    queryClient.clear();
    client.logout();
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="ws-shell">
      <header className="ws-topbar">
        <div className="ws-brand">
          <span className="ws-brand-name">{t("app.title")}</span>
          <span className="ws-brand-sub">{t("app.subtitle")}</span>
        </div>

        <div className="ws-clinic">
          <span className="ws-clinic-name" data-testid="active-clinic">
            {session.clinicName}
          </span>
          {alternatives.length > 0 && (
            <label className="ws-clinic-switch">
              <span className="ws-visually-hidden">{t("clinic.switch")}</span>
              <select
                disabled={switching}
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    void handleSwitch(e.target.value);
                  }
                }}
              >
                <option value="">{switching ? t("clinic.switching") : t("clinic.switch")}</option>
                {alternatives.map((c) => (
                  <option key={c.clinicId} value={c.clinicId}>
                    {c.clinicName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {switchError && (
            <span className="ws-error-text" role="alert">
              {switchError}
            </span>
          )}
        </div>

        <div className="ws-topbar-actions">
          <div className="ws-lang-toggle" role="group" aria-label="Language">
            <button
              type="button"
              className={lang === "uk" ? "ws-lang-active" : undefined}
              onClick={() => switchLang("uk")}
            >
              УК
            </button>
            <button
              type="button"
              className={lang === "en" ? "ws-lang-active" : undefined}
              onClick={() => switchLang("en")}
            >
              EN
            </button>
          </div>
          <span className="ws-user">
            {session.fullName} · {t(`role.${session.role}`)}
          </span>
          <button type="button" className="ws-button ws-button-ghost" onClick={handleLogout}>
            {t("nav.logout")}
          </button>
        </div>
      </header>

      <div className="ws-body">
        <nav className="ws-nav" aria-label={t("app.subtitle")}>
          <NavLink
            to="patients"
            className={({ isActive }) => (isActive ? "ws-nav-link ws-nav-active" : "ws-nav-link")}
          >
            {t("nav.patients")}
          </NavLink>
          <NavLink to="staff" className={({ isActive }) => (isActive ? "ws-nav-link ws-nav-active" : "ws-nav-link")}>
            {t("nav.staff")}
          </NavLink>
          {session.role === "ClinicAdmin" && (
            <NavLink
              to="settings"
              className={({ isActive }) => (isActive ? "ws-nav-link ws-nav-active" : "ws-nav-link")}
            >
              {t("nav.settings")}
            </NavLink>
          )}
          <NavLink
            to="profile"
            className={({ isActive }) => (isActive ? "ws-nav-link ws-nav-active" : "ws-nav-link")}
          >
            {t("nav.profile")}
          </NavLink>
        </nav>
        <main className="ws-content" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
