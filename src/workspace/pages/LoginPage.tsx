import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ClinicMembershipSummary } from "../../api/types";
import { useAuth } from "../AuthContext";

export function LoginPage(): ReactNode {
  const { client, setSession, t } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clinicChoices, setClinicChoices] = useState<ClinicMembershipSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const authenticate = async (clinicId?: string): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await client.login({ email, password, clinicId });
      if (result.requiresClinicSelection) {
        setClinicChoices(result.clinics);
        return;
      }
      if (result.token && result.userId) {
        setSession({
          token: result.token,
          userId: result.userId,
          fullName: result.fullName ?? "",
          email: result.email ?? email,
          clinicId: result.clinicId ?? "",
          clinicName: result.clinicName ?? "",
          role: result.role ?? "",
        });
        navigate("/", { replace: true });
      }
    } catch {
      setError(t("login.invalid"));
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!email || !password || submitting) {
      return;
    }
    void authenticate();
  };

  const pickClinic = (clinic: ClinicMembershipSummary): void => {
    void authenticate(clinic.clinicId);
  };

  return (
    <div className="ws-auth-screen">
      <form className="ws-auth-card" onSubmit={onSubmit} noValidate>
        <h1>{t("login.title")}</h1>

        {clinicChoices ? (
          <div className="ws-clinic-picker">
            <p className="ws-field-label">{t("login.selectClinic")}</p>
            <ul className="ws-clinic-options">
              {clinicChoices.map((c) => (
                <li key={c.clinicId}>
                  <button
                    type="button"
                    className="ws-button ws-button-block"
                    disabled={submitting}
                    onClick={() => pickClinic(c)}
                  >
                    {c.clinicName} · {t(`role.${c.role}`)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <label className="ws-field">
              <span className="ws-field-label">{t("login.email")}</span>
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="ws-field">
              <span className="ws-field-label">{t("login.password")}</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </>
        )}

        {error && (
          <p className="ws-error-text" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="ws-button ws-button-primary" disabled={submitting}>
          {submitting ? t("login.submitting") : t("login.submit")}
        </button>

        <p className="ws-auth-alt">
          <Link to="/onboarding">{t("login.onboardingLink")}</Link>
        </p>
      </form>
    </div>
  );
}
