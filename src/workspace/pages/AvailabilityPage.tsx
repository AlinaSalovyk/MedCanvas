import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Weekly availability editor: per-weekday working windows with one lunch-style break each (M03). */
export function AvailabilityPage(): ReactNode {
  const { client, session, t } = useAuth();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["clinic-members", session?.clinicId],
    queryFn: () => client.getClinicMembers(),
    enabled: Boolean(session) && session.role === "ClinicAdmin",
  });

  const clinicians = (membersQuery.data ?? []).filter(
    (m) => m.membershipActive && (m.role === "Clinician" || m.role === "ClinicAdmin")
  );

  const [clinicianId, setClinicianId] = useState("");
  useEffect(() => {
    if (!clinicianId && clinicians.length > 0) {
      setClinicianId(clinicians[0].userId);
    }
  }, [clinicians, clinicianId]);

  const availabilityQuery = useQuery({
    queryKey: ["availability", session?.clinicId, clinicianId],
    queryFn: () => client.getAvailability(clinicianId),
    enabled: Boolean(clinicianId),
  });

  const [windows, setWindows] = useState<Record<number, { start: string; end: string; breakStart: string; breakEnd: string }>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (availabilityQuery.data) {
      const next: typeof windows = {};
      for (const w of availabilityQuery.data.windows) {
        const brk = w.breaks[0];
        next[w.dayOfWeek] = {
          start: w.startTime,
          end: w.endTime,
          breakStart: brk?.startTime ?? "",
          breakEnd: brk?.endTime ?? "",
        };
      }
      setWindows(next);
      setSaved(false);
    }
  }, [availabilityQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      client.replaceAvailability(
        clinicianId,
        Object.entries(windows)
          .map(([day, w]) => ({
            dayOfWeek: Number(day),
            startTime: w.start,
            endTime: w.end,
            breaks: w.breakStart && w.breakEnd ? [{ startTime: w.breakStart, endTime: w.breakEnd }] : [],
          }))
          .filter((w) => w.endTime > w.startTime)
      ),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["availability"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    setSaved(false);
    save.mutate();
  };

  const setDay = (day: number, patch: Partial<{ start: string; end: string; breakStart: string; breakEnd: string }>): void => {
    setWindows((prev) => ({
      ...prev,
      [day]: { start: "09:00", end: "18:00", breakStart: "", breakEnd: "", ...prev[day], ...patch },
    }));
  };

  return (
    <section>
      <h1>{t("availability.title")}</h1>

      <label className="ws-field ws-field-narrow">
        <span className="ws-field-label">{t("calendar.clinician")}</span>
        <select value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}>
          {clinicians.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.fullName}
            </option>
          ))}
        </select>
      </label>

      {availabilityQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : availabilityQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void availabilityQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <form className="ws-card" onSubmit={onSubmit}>
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">{t("availability.day")}</th>
                <th scope="col">{t("availability.working")}</th>
                <th scope="col">{t("availability.start")}</th>
                <th scope="col">{t("availability.end")}</th>
                <th scope="col">{t("availability.breakStart")}</th>
                <th scope="col">{t("availability.breakEnd")}</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((day) => {
                const w = windows[day];
                return (
                  <tr key={day}>
                    <td>{t(`availability.days.${day}`)}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${t("availability.working")} ${t(`availability.days.${day}`)}`}
                        checked={Boolean(w)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDay(day, {});
                          } else {
                            setWindows((prev) => {
                              const next = { ...prev };
                              delete next[day];
                              return next;
                            });
                          }
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        disabled={!w}
                        value={w?.start ?? "09:00"}
                        onChange={(e) => setDay(day, { start: e.target.value })}
                        aria-label={`${t("availability.start")} ${t(`availability.days.${day}`)}`}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        disabled={!w}
                        value={w?.end ?? "18:00"}
                        onChange={(e) => setDay(day, { end: e.target.value })}
                        aria-label={`${t("availability.end")} ${t(`availability.days.${day}`)}`}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        disabled={!w}
                        value={w?.breakStart ?? ""}
                        onChange={(e) => setDay(day, { breakStart: e.target.value })}
                        aria-label={`${t("availability.breakStart")} ${t(`availability.days.${day}`)}`}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        disabled={!w}
                        value={w?.breakEnd ?? ""}
                        onChange={(e) => setDay(day, { breakEnd: e.target.value })}
                        aria-label={`${t("availability.breakEnd")} ${t(`availability.days.${day}`)}`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {error && (
            <p className="ws-error-text" role="alert">
              {error}
            </p>
          )}
          {saved && !error && (
            <p className="ws-ok-text" role="status">
              {t("settings.saved")}
            </p>
          )}

          <button type="submit" className="ws-button ws-button-primary" disabled={save.isPending || !clinicianId}>
            {t("settings.save")}
          </button>
        </form>
      )}
    </section>
  );
}
