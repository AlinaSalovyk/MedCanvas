import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { WorkspaceLayout } from "./WorkspaceLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { StaffPage } from "./pages/StaffPage";
import { ClinicSettingsPage } from "./pages/ClinicSettingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { CalendarPage } from "./pages/CalendarPage";
import { CatalogPage } from "./pages/CatalogPage";
import { TreatmentPlansPage } from "./pages/TreatmentPlansPage";
import { EncounterPage } from "./pages/EncounterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ChairsPage } from "./pages/ChairsPage";
import { AvailabilityPage } from "./pages/AvailabilityPage";
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
        <Route index element={<DashboardPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route
          path="catalog"
          element={
            <RequireRole roles={["ClinicAdmin"]}>
              <CatalogPage />
            </RequireRole>
          }
        />
        <Route path="patients/:patientId/plans" element={<TreatmentPlansPage />} />
        <Route path="encounters/:id" element={<EncounterPage />} />
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
        <Route
          path="chairs"
          element={
            <RequireRole roles={["ClinicAdmin"]}>
              <ChairsPage />
            </RequireRole>
          }
        />
        <Route
          path="availability"
          element={
            <RequireRole roles={["ClinicAdmin"]}>
              <AvailabilityPage />
            </RequireRole>
          }
        />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
