import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { StaffPage } from "./pages/StaffPage";
import { ClinicSettingsPage } from "./pages/ClinicSettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PatientsPage } from "./pages/PatientsPage";
import { PatientDetailPage } from "./pages/PatientDetailPage";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }): ReactNode {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }): ReactNode {
  const { session, t } = useAuth();
  if (session && !roles.includes(session.role)) {
    return (
      <section className="ws-unauthorized" aria-live="polite">
        <h2>{t("unauthorized.title")}</h2>
        <p>{t("unauthorized.body")}</p>
      </section>
    );
  }
  return <>{children}</>;
}

export function WorkspaceApp(): ReactNode {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <WorkspaceLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="staff" replace />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route
          path="staff"
          element={
            <RequireRole roles={["ClinicAdmin"]}>
              <StaffPage />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={["ClinicAdmin"]}>
              <ClinicSettingsPage />
            </RequireRole>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
