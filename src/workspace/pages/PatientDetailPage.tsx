import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useAuth } from "../AuthContext";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

/** Patient 360 card: identity, contacts, medical alerts, visit history, and the
 *  latest odontogram metadata (chart rendering itself arrives with M04). */
export function PatientDetailPage(): ReactNode {
  const { client, session, t } = useAuth();
  const { id } = useParams<{ id: string }>();

  const patientQuery = useQuery({
    queryKey: ["patient", session?.clinicId, id],
    queryFn: () => client.getPatient(id!),
    enabled: Boolean(id),
  });

  const encountersQuery = useQuery({
    queryKey: ["patient-encounters", session?.clinicId, id],
    queryFn: () => client.getPatientEncounters(id!),
    enabled: Boolean(id),
  });

  const latestChartQuery = useQuery({
    queryKey: ["patient-latest-chart", session?.clinicId, id],
    queryFn: () => client.getLatestOdontogramByPatient(id!),
    enabled: Boolean(id),
    retry: false,
  });

  if (patientQuery.isLoading) {
    return (
      <section aria-live="polite">
        <p>{t("common.loading")}</p>
      </section>
    );
  }

  if (patientQuery.isError || !patientQuery.data) {
    return (
      <section role="alert">
        <p className="ws-error-text">{t("patients.notFound")}</p>
        <Link to="/patients" className="ws-button">
          {t("patients.backToList")}
        </Link>
      </section>
    );
  }

  const patient = patientQuery.data;

  return (
    <section>
      <div className="ws-page-header">
        <h1>{patient.fullName}</h1>
        {!patient.isActive && <span className="ws-badge ws-badge-archived">{t("patients.archived")}</span>}
      </div>

      <div className="ws-detail-grid">
        <div className="ws-card">
          <h2>{t("patients.basicInfo")}</h2>
          <dl className="ws-profile">
            <dt>{t("patients.fullName")}</dt>
            <dd>{patient.fullName}</dd>
            <dt>{t("patients.dob")}</dt>
            <dd>{patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "—"}</dd>
            <dt>{t("patients.gender")}</dt>
            <dd>{patient.gender ?? "—"}</dd>
            <dt>{t("patients.mrn")}</dt>
            <dd>{patient.externalMedicalRecordNumber ?? "—"}</dd>
          </dl>
        </div>

        <div className="ws-card">
          <h2>{t("patients.contacts")}</h2>
          <dl className="ws-profile">
            <dt>{t("patients.phone")}</dt>
            <dd>{patient.phone ?? "—"}</dd>
            <dt>{t("patients.email")}</dt>
            <dd>{patient.email ?? "—"}</dd>
          </dl>
        </div>

        <div className="ws-card">
          <h2>{t("patients.alerts")}</h2>
          <p className={patient.medicalAlerts ? "ws-alerts-text" : "ws-muted"}>
            {patient.medicalAlerts ?? t("patients.noAlerts")}
          </p>
        </div>

        <div className="ws-card">
          <h2>{t("patients.latestChart")}</h2>
          {latestChartQuery.isError || !latestChartQuery.data ? (
            <p className="ws-muted">{t("patients.noChart")}</p>
          ) : (
            <dl className="ws-profile">
              <dt>{t("patients.chartUpdated")}</dt>
              <dd>{formatDate(latestChartQuery.data.odontogram.updatedAtUtc)}</dd>
              <dt>{t("patients.chartVersion")}</dt>
              <dd>
                {latestChartQuery.data.odontogram.payloadVersion} · v{latestChartQuery.data.odontogram.concurrencyVersion}
              </dd>
              <dt>{t("patients.chartFinalized")}</dt>
              <dd>{latestChartQuery.data.odontogram.isFinalized ? t("common.yes") : t("common.no")}</dd>
            </dl>
          )}
          <p className="ws-muted">{t("patients.chartNote")}</p>
        </div>

        <div className="ws-card ws-card-wide">
          <h2>{t("patients.history")}</h2>
          {encountersQuery.isLoading ? (
            <p aria-live="polite">{t("common.loading")}</p>
          ) : (encountersQuery.data?.length ?? 0) === 0 ? (
            <p className="ws-empty">{t("patients.noVisits")}</p>
          ) : (
            <table className="ws-table">
              <thead>
                <tr>
                  <th scope="col">{t("patients.visitDate")}</th>
                  <th scope="col">{t("patients.visitComplaint")}</th>
                  <th scope="col">{t("patients.visitStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {encountersQuery.data!.map((e) => (
                  <tr key={e.id}>
                    <td>{formatDate(e.startedAtUtc)}</td>
                    <td>{e.chiefComplaint ?? "—"}</td>
                    <td>{t(`patients.encounterStatus.${e.status}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
