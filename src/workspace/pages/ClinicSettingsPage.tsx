import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";

const COMMON_TIME_ZONES = ["Europe/Kyiv", "Europe/London", "Europe/Berlin", "UTC"];

export function ClinicSettingsPage(): ReactNode {
  const { client, session, t } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["clinic-settings", session?.clinicId],
    queryFn: () => client.getClinicSettings(),
    enabled: Boolean(session),
  });

  const [name, setName] = useState("");
  const [timeZoneId, setTimeZoneId] = useState("Europe/Kyiv");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setName(settingsQuery.data.name);
      setTimeZoneId(settingsQuery.data.timeZoneId);
    }
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: () => client.updateClinicSettings({ name, timeZoneId }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ["clinic-settings"] });
    },
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setSaved(false);
    save.mutate();
  };

  if (settingsQuery.isLoading) {
    return (
      <section aria-live="polite">
        <p>{t("common.loading")}</p>
      </section>
    );
  }

  if (settingsQuery.isError) {
    return (
      <section role="alert">
        <p className="ws-error-text">{t("common.error")}</p>
        <button type="button" className="ws-button" onClick={() => void settingsQuery.refetch()}>
          {t("common.retry")}
        </button>
      </section>
    );
  }

  return (
    <section>
      <h1>{t("settings.title")}</h1>
      <form className="ws-card" onSubmit={onSubmit}>
        <label className="ws-field">
          <span className="ws-field-label">{t("settings.name")}</span>
          <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="ws-field">
          <span className="ws-field-label">{t("settings.identifier")}</span>
          <input readOnly value={settingsQuery.data?.identifier ?? ""} />
        </label>
        <label className="ws-field">
          <span className="ws-field-label">{t("settings.timezone")}</span>
          <select value={timeZoneId} onChange={(e) => setTimeZoneId(e.target.value)}>
            {Array.from(new Set([...COMMON_TIME_ZONES, timeZoneId])).map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </label>

        {save.isError && (
          <p className="ws-error-text" role="alert">
            {save.error instanceof Error ? save.error.message : t("common.saveError")}
          </p>
        )}
        {saved && !save.isError && (
          <p className="ws-ok-text" role="status">
            {t("settings.saved")}
          </p>
        )}

        <button type="submit" className="ws-button ws-button-primary" disabled={save.isPending}>
          {t("settings.save")}
        </button>
      </form>
    </section>
  );
}
