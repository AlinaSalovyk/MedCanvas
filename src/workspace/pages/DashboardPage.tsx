import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuth } from "../AuthContext";

/** FR-704/705: minimal operational dashboard over REAL tenant data. Finance
 *  figures are DEMO simulated amounts and are labeled as such (INV-008). */
export function DashboardPage(): ReactNode {
  const { client, session, t } = useAuth();

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", session?.clinicId, session?.userId],
    queryFn: () => client.getDashboard(),
    enabled: Boolean(session),
  });

  const dash = dashboardQuery.data;

  const cards: Array<{ label: string; value: number; to: string }> = [
    { label: t("dashboard.todays"), value: dash?.todaysAppointments ?? 0, to: "/calendar" },
    { label: t("dashboard.waiting"), value: dash?.waitingPatients ?? 0, to: "/calendar" },
    { label: t("dashboard.inProgress"), value: dash?.inProgressEncounters ?? 0, to: "/patients" },
    { label: t("dashboard.completed"), value: dash?.completedToday ?? 0, to: "/calendar" },
    { label: t("dashboard.upcoming"), value: dash?.upcomingAppointments7Days ?? 0, to: "/calendar" },
    { label: t("dashboard.invoices"), value: dash?.invoicesIssuedToday ?? 0, to: "/patients" },
  ];

  return (
    <section>
      <h1>{t("dashboard.title")}</h1>
      <p className="ws-muted">{session?.role === "Clinician" ? t("dashboard.clinicianScope") : t("dashboard.adminScope")}</p>

      {dashboardQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : dashboardQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void dashboardQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          <div className="ws-detail-grid">
            {cards.map((card) => (
              <Link key={card.label} to={card.to} className="ws-dash-card">
                <span className="ws-dash-value" data-testid="dash-value">
                  {card.value}
                </span>
                <span className="ws-dash-label">{card.label}</span>
              </Link>
            ))}
          </div>

          <div className="ws-card ws-finished-note" role="status">
            {t("dashboard.demoNote")} ·{" "}
            {t("dashboard.simulatedToday")}: {(dash?.simulatedPaymentsToday ?? 0).toFixed(2)} UAH
          </div>
        </>
      )}
    </section>
  );
}
