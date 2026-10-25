import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppointmentDto, AppointmentStatus, PatientDto } from "../../api/types";
import { useAuth } from "../AuthContext";

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  Scheduled: "ws-appt-scheduled",
  Confirmed: "ws-appt-confirmed",
  Arrived: "ws-appt-arrived",
  InProgress: "ws-appt-inprogress",
  Completed: "ws-appt-completed",
  Cancelled: "ws-appt-cancelled",
  NoShow: "ws-appt-noshow",
};

const NEXT_ACTIONS: Partial<Record<AppointmentStatus, Array<{ action: "confirm" | "arrive" | "complete" | "no-show" | "cancel"; key: string }>>> = {
  Scheduled: [
    { action: "confirm", key: "calendar.confirm" },
    { action: "no-show", key: "calendar.noShow" },
    { action: "cancel", key: "calendar.cancel" },
  ],
  Confirmed: [
    { action: "arrive", key: "calendar.arrive" },
    { action: "no-show", key: "calendar.noShow" },
    { action: "cancel", key: "calendar.cancel" },
  ],
  Arrived: [
    { action: "complete", key: "calendar.complete" },
    { action: "cancel", key: "calendar.cancel" },
  ],
  InProgress: [{ action: "complete", key: "calendar.complete" }],
};

function startOfWeekUtc(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  date.setUTCDate(date.getUTCDate() - diff);
  return date;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toLocalInput(utc: Date): string {
  const local = new Date(utc.getTime() - utc.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string): Date {
  return new Date(value); // interpreted in the user's local zone, sent as ISO UTC
}

export function CalendarPage(): ReactNode {
  const { client, session, t } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const canManage = session?.role === "ClinicAdmin" || session?.role === "Clinician" || session?.role === "Assistant";

  const [weekStart, setWeekStart] = useState(() => startOfWeekUtc(new Date()));
  const [view, setView] = useState<"day" | "week">("week");
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const from = useMemo(() => (view === "week" ? weekStart : startOfWeekUtc(selectedDay)), [view, weekStart, selectedDay]);
  const to = useMemo(() => addDays(from, view === "week" ? 7 : 1), [from, view]);

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", session?.clinicId, from.toISOString(), to.toISOString(), statusFilter],
    queryFn: () =>
      client.getAppointments({
        fromUtc: from.toISOString(),
        toUtc: to.toISOString(),
        status: statusFilter ? (statusFilter as AppointmentStatus) : undefined,
      }),
    enabled: Boolean(session),
  });

  const chairsQuery = useQuery({
    queryKey: ["chairs", session?.clinicId],
    queryFn: () => client.getChairs(),
    enabled: Boolean(session),
  });

  const membersQuery = useQuery({
    queryKey: ["clinic-members", session?.clinicId],
    queryFn: () => client.getClinicMembers(),
    enabled: Boolean(session) && session.role === "ClinicAdmin",
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["appointments"] });
  };

  const action = useMutation({
    mutationFn: ({ id, act }: { id: string; act: "confirm" | "arrive" | "complete" | "no-show" }) =>
      client.appointmentAction(id, act),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const startEncounter = useMutation({
    mutationFn: (appt: AppointmentDto) =>
      client.startEncounter({ patientId: appt.patientId, appointmentId: appt.id }),
    onSuccess: (encounter) => {
      setActionError(null);
      invalidate();
      navigate("/encounters/" + encounter.id);
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => client.cancelAppointment(id, t("calendar.defaultCancelReason")),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const days = useMemo(() => {
    if (view === "day") return [selectedDay];
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [view, weekStart, selectedDay]);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentDto[]>();
    for (const appt of appointmentsQuery.data ?? []) {
      const key = new Date(appt.startAtUtc).toISOString().slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), appt]);
    }
    return map;
  }, [appointmentsQuery.data]);

  return (
    <section>
      <div className="ws-page-header">
        <h1>{t("calendar.title")}</h1>
        {canManage && (
          <button type="button" className="ws-button ws-button-primary" onClick={() => setBookingOpen(true)}>
            {t("calendar.book")}
          </button>
        )}
      </div>

      <div className="ws-filters">
        <div className="ws-view-toggle" role="tablist" aria-label={t("calendar.view")}>
          <button
            type="button"
            role="tab"
            aria-selected={view === "day"}
            className={view === "day" ? "ws-tab ws-tab-active" : "ws-tab"}
            onClick={() => setView("day")}
          >
            {t("calendar.day")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "week"}
            className={view === "week" ? "ws-tab ws-tab-active" : "ws-tab"}
            onClick={() => setView("week")}
          >
            {t("calendar.week")}
          </button>
        </div>
        <label className="ws-filter">
          <span className="ws-field-label">{t("calendar.date")}</span>
          <input
            type="date"
            value={new Date(selectedDay.getTime() - selectedDay.getTimezoneOffset() * 60000).toISOString().slice(0, 10)}
            onChange={(e) => {
              const d = new Date(e.target.value + "T00:00:00");
              setSelectedDay(d);
              setWeekStart(startOfWeekUtc(d));
            }}
          />
        </label>
        <label className="ws-filter">
          <span className="ws-field-label">{t("calendar.status")}</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t("calendar.allStatuses")}</option>
            {Object.keys(STATUS_COLORS).map((s) => (
              <option key={s} value={s}>
                {t(`calendar.statuses.${s}`)}
              </option>
            ))}
          </select>
        </label>
        {view === "week" && (
          <div className="ws-week-nav">
            <button type="button" className="ws-button" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              ‹
            </button>
            <button type="button" className="ws-button" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              ›
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <p className="ws-error-text" role="alert">
          {actionError}
        </p>
      )}

      {appointmentsQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : appointmentsQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void appointmentsQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <div className={view === "week" ? "ws-calendar-grid" : "ws-calendar-day"}>
          {days.map((day) => {
            const key = day.toISOString().slice(0, 10);
            const list = (byDay.get(key) ?? []).sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc));
            return (
              <div key={key} className="ws-calendar-col">
                <h3 className="ws-calendar-day-title">{day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</h3>
                {list.length === 0 ? (
                  <p className="ws-muted ws-calendar-empty">—</p>
                ) : (
                  list.map((appt) => (
                    <article key={appt.id} className={`ws-appt ${STATUS_COLORS[appt.status]}`}>
                      <div className="ws-appt-time">
                        {new Date(appt.startAtUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–
                        {new Date(appt.endAtUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="ws-appt-patient">{appt.patientFullName}</div>
                      <div className="ws-appt-meta">
                        {appt.clinicianFullName} · {appt.chairName}
                      </div>
                      <div className="ws-appt-status">{t(`calendar.statuses.${appt.status}`)}</div>
                      {canManage && appt.status !== "Completed" && appt.status !== "Cancelled" && appt.status !== "NoShow" && (
                        <div className="ws-appt-actions">
                          {(appt.status === "Confirmed" || appt.status === "Arrived") && (
                            <button
                              type="button"
                              className="ws-button ws-button-small ws-button-primary"
                              disabled={startEncounter.isPending}
                              onClick={() => startEncounter.mutate(appt)}
                            >
                              {t("calendar.startEncounter")}
                            </button>
                          )}
                          {(NEXT_ACTIONS[appt.status] ?? []).map(({ action: act, key: actionKey }) => (
                            <button
                              key={actionKey}
                              type="button"
                              className="ws-button ws-button-small"
                              disabled={action.isPending || cancel.isPending}
                              onClick={() => {
                                if (act === "cancel") {
                                  if (window.confirm(t("calendar.confirmCancel"))) {
                                    cancel.mutate(appt.id);
                                  }
                                } else {
                                  action.mutate({ id: appt.id, act });
                                }
                              }}
                            >
                              {t(actionKey)}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {bookingOpen || (canManage && searchParams.get("book")) ? (
        <BookingDialog
          presetPatientId={searchParams.get("book") ?? undefined}
          onClose={() => {
            setBookingOpen(false);
            if (searchParams.get("book")) {
              navigate("/calendar", { replace: true });
            }
          }}
          clinicians={(membersQuery.data ?? []).filter((m) => m.membershipActive && (m.role === "Clinician" || m.role === "ClinicAdmin"))}
          chairs={(chairsQuery.data ?? []).filter((c) => c.isActive)}
          defaultDay={selectedDay}
        />
      ) : null}
    </section>
  );
}

function BookingDialog({
  onClose,
  clinicians,
  chairs,
  defaultDay,
  presetPatientId,
}: {
  onClose: () => void;
  clinicians: Array<{ userId: string; fullName: string; role: string }>;
  chairs: Array<{ id: string; name: string }>;
  defaultDay: Date;
  presetPatientId?: string;
}): ReactNode {
  const { client, t } = useAuth();
  const queryClient = useQueryClient();

  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState<PatientDto[]>([]);
  const [patientId, setPatientId] = useState("");
  const [clinicianId, setClinicianId] = useState(clinicians[0]?.userId ?? "");
  const [chairId, setChairId] = useState(chairs[0]?.id ?? "");
  const [start, setStart] = useState(toLocalInput(new Date(defaultDay.setHours(9, 0, 0, 0))));
  const [duration, setDuration] = useState(30);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const applyPatients = (items: PatientDto[]): void => {
    setPatients(items);
    if (presetPatientId) {
      const match = items.find((p) => p.id === presetPatientId);
      if (match) {
        setPatientId(match.id);
      }
    }
  };

  const searchPatients = (): void => {
    void client
      .getPatients({ searchTerm: patientSearch.trim() || undefined, pageSize: 8 })
      .then((r) => applyPatients(r.items))
      .catch(() => setPatients([]));
  };

  // FR-701/FR-207: arriving with a preset patient (follow-up booking) fetches the
  // patient list straight away so the booking select can preselect them.
  useEffect(() => {
    if (presetPatientId) {
      void client
        .getPatients({ searchTerm: undefined, pageSize: 8 })
        .then((r) => applyPatients(r.items))
        .catch(() => setPatients([]));
    }
    // applyPatients is stable per preset; the fetch must run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPatientId]);

  const book = useMutation({
    mutationFn: () => {
      const startUtc = fromLocalInput(start);
      return client.createAppointment({
        patientId,
        clinicianUserId: clinicianId,
        chairId,
        startAtUtc: startUtc.toISOString(),
        endAtUtc: new Date(startUtc.getTime() + duration * 60000).toISOString(),
        reasonForVisit: reason,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!book.isPending) {
      book.mutate();
    }
  };

  return (
    <div className="ws-modal-backdrop" role="dialog" aria-modal="true" aria-label={t("calendar.book")}>
      <form className="ws-modal ws-card" onSubmit={onSubmit}>
        <h2>{t("calendar.book")}</h2>

        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("calendar.patient")}</span>
            <div className="ws-inline-row">
              <input
                placeholder={t("patients.search")}
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
              />
              <button type="button" className="ws-button" onClick={searchPatients}>
                {t("patients.search")}
              </button>
            </div>
            {patients.length > 0 && (
              <select
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                aria-label={t("calendar.patient")}
              >
                <option value="">— {t("calendar.choosePatient")} —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} {p.externalMedicalRecordNumber ? `(${p.externalMedicalRecordNumber})` : ""}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("calendar.clinician")}</span>
            <select required value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}>
              {clinicians.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("calendar.chair")}</span>
            <select required value={chairId} onChange={(e) => setChairId(e.target.value)}>
              {chairs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("calendar.start")}</span>
            <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("calendar.duration")}</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120].map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="ws-field">
          <span className="ws-field-label">{t("calendar.reason")}</span>
          <input required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>

        {error && (
          <p className="ws-error-text" role="alert">
            {error}
          </p>
        )}

        <div className="ws-form-actions">
          <button type="submit" className="ws-button ws-button-primary" disabled={book.isPending || !patientId}>
            {t("calendar.book")}
          </button>
          <button type="button" className="ws-button" onClick={onClose}>
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  );
}
