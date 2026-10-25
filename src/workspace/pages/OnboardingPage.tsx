import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

const COMMON_TIME_ZONES = ["Europe/Kyiv", "Europe/London", "Europe/Berlin", "UTC"];

export function OnboardingPage(): ReactNode {
  const { client, setSession, t } = useAuth();
  const navigate = useNavigate();

  const [clinicName, setClinicName] = useState("");
  const [clinicIdentifier, setClinicIdentifier] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [timeZoneId, setTimeZoneId] = useState("Europe/Kyiv");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await client.onboardClinic({
        clinicName,
        clinicIdentifier,
        adminEmail,
        adminFullName,
        adminPassword,
        timeZoneId,
      });
      if (result.token && result.userId && result.clinicId) {
        setSession({
          token: result.token,
          userId: result.userId,
          fullName: result.fullName ?? adminFullName,
          email: result.email ?? adminEmail,
          clinicId: result.clinicId,
          clinicName: result.clinicName ?? clinicName,
          role: result.role ?? "ClinicAdmin",
        });
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ws-auth-screen">
      <form className="ws-auth-card" onSubmit={(e) => void onSubmit(e)} noValidate>
        <h1>{t("onboarding.title")}</h1>

        <label className="ws-field">
          <span className="ws-field-label">{t("onboarding.clinicName")}</span>
          <input required maxLength={200} value={clinicName} onChange={(e) => setClinicName(e.target.value)} />
        </label>
        <label className="ws-field">
          <span className="ws-field-label">{t("onboarding.identifier")}</span>
          <input
            required
            maxLength={50}
            pattern="[A-Za-z0-9][A-Za-z0-9-]*"
            value={clinicIdentifier}
            onChange={(e) => setClinicIdentifier(e.target.value)}
          />
        </label>
        <label className="ws-field">
          <span className="ws-field-label">{t("onboarding.fullName")}</span>
          <input required maxLength={200} value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} />
        </label>
        <label className="ws-field">
          <span className="ws-field-label">{t("onboarding.email")}</span>
          <input
            type="email"
            required
            maxLength={256}
            autoComplete="username"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
        </label>
        <label className="ws-field">
          <span className="ws-field-label">{t("onboarding.password")}</span>
          <input
            type="password"
            required
            minLength={8}
            maxLength={100}
            autoComplete="new-password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
          />
        </label>
        <label className="ws-field">
          <span className="ws-field-label">{t("onboarding.timezone")}</span>
          <select value={timeZoneId} onChange={(e) => setTimeZoneId(e.target.value)}>
            {COMMON_TIME_ZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="ws-error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="ws-button ws-button-primary" disabled={submitting}>
          {t("onboarding.submit")}
        </button>

        <p className="ws-auth-alt">
          <Link to="/login">{t("onboarding.backToLogin")}</Link>
        </p>
      </form>
    </div>
  );
}
