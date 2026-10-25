import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PatientDto } from "../../api/types";
import { useAuth } from "../AuthContext";

const SORT_OPTIONS = ["lastname", "firstname", "birthdate", "created"] as const;

interface PatientFormState {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  mrn: string;
  medicalAlerts: string;
  concurrencyVersion?: number;
}

const EMPTY_FORM: PatientFormState = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  mrn: "",
  medicalAlerts: "",
};

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function PatientsPage(): ReactNode {
  const { client, session, t } = useAuth();
  const queryClient = useQueryClient();

  const canMutate = session?.role === "ClinicAdmin" || session?.role === "Clinician" || session?.role === "Assistant";

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("lastname");
  const [sortDescending, setSortDescending] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState<PatientFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<PatientDto[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const patientsQuery = useQuery({
    queryKey: ["patients", session?.clinicId, appliedSearch, sortBy, sortDescending, includeArchived, page],
    queryFn: () =>
      client.getPatients({
        pageNumber: page,
        pageSize: 10,
        searchTerm: appliedSearch || undefined,
        sortBy,
        sortDescending,
        includeArchived,
      }),
    enabled: Boolean(session),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["patients"] });
  };

  const checkDuplicates = async (candidate: PatientFormState): Promise<void> => {
    setDuplicates([]);
    if (!candidate.mrn && !(candidate.firstName && candidate.lastName && candidate.dateOfBirth)) {
      return;
    }
    try {
      const matches = await client.getPatientDuplicates({
        firstName: candidate.firstName || undefined,
        lastName: candidate.lastName || undefined,
        dateOfBirth: candidate.dateOfBirth || undefined,
        externalMedicalRecordNumber: candidate.mrn || undefined,
      });
      setDuplicates(matches.filter((m) => m.id !== candidate.id));
    } catch {
      // Advisory only — never blocks creation
    }
  };

  const save = useMutation({
    mutationFn: async (candidate: PatientFormState) => {
      const body = {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        dateOfBirth: candidate.dateOfBirth || null,
        gender: candidate.gender || null,
        phone: candidate.phone || null,
        email: candidate.email || null,
        externalMedicalRecordNumber: candidate.mrn || null,
        medicalAlerts: candidate.medicalAlerts || null,
      };
      if (candidate.id) {
        return client.updatePatient(candidate.id, body, candidate.concurrencyVersion ?? 1);
      }
      return client.createPatient(body);
    },
    onSuccess: () => {
      setForm(null);
      setFormError(null);
      setDuplicates([]);
      invalidate();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => client.archivePatient(id),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const restore = useMutation({
    mutationFn: (id: string) => client.restorePatient(id),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const openCreate = (): void => {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setDuplicates([]);
  };

  const openEdit = (p: PatientDto): void => {
    setForm({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dateOfBirth ?? "",
      gender: p.gender ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      mrn: p.externalMedicalRecordNumber ?? "",
      medicalAlerts: p.medicalAlerts ?? "",
      concurrencyVersion: p.concurrencyVersion ?? 1,
    });
    setFormError(null);
    setDuplicates([]);
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (form && !save.isPending) {
      save.mutate(form);
    }
  };

  const result = patientsQuery.data;
  const totalPages = result?.totalPages ?? 1;

  return (
    <section>
      <div className="ws-page-header">
        <h1>{t("patients.title")}</h1>
        {canMutate && (
          <button type="button" className="ws-button ws-button-primary" onClick={openCreate}>
            {t("patients.add")}
          </button>
        )}
      </div>

      <div className="ws-filters">
        <form
          className="ws-search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(searchTerm.trim());
          }}
        >
          <label className="ws-visually-hidden" htmlFor="patient-search">
            {t("patients.search")}
          </label>
          <input
            id="patient-search"
            type="search"
            placeholder={t("patients.search")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="ws-button">
            {t("patients.search")}
          </button>
        </form>
        <label className="ws-filter">
          <span className="ws-field-label">{t("patients.sortBy")}</span>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {t(`patients.sort.${opt}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="ws-filter ws-check">
          <input
            type="checkbox"
            checked={sortDescending}
            onChange={(e) => { setSortDescending(e.target.checked); setPage(1); }}
          />
          <span>{t("patients.sortDesc")}</span>
        </label>
        <label className="ws-filter ws-check">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => { setIncludeArchived(e.target.checked); setPage(1); }}
          />
          <span>{t("patients.showArchived")}</span>
        </label>
      </div>

      {actionError && (
        <p className="ws-error-text" role="alert">
          {actionError}
        </p>
      )}

      {form && (
        <form className="ws-card ws-patient-form" onSubmit={onSubmit}>
          <h2>{form.id ? t("patients.edit") : t("patients.add")}</h2>
          <div className="ws-form-row">
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.firstName")}</span>
              <input
                required
                maxLength={100}
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                onBlur={() => void checkDuplicates(form)}
              />
            </label>
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.lastName")}</span>
              <input
                required
                maxLength={100}
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                onBlur={() => void checkDuplicates(form)}
              />
            </label>
          </div>
          <div className="ws-form-row">
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.dob")}</span>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                onBlur={() => void checkDuplicates(form)}
              />
            </label>
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.gender")}</span>
              <input maxLength={20} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
            </label>
          </div>
          <div className="ws-form-row">
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.phone")}</span>
              <input maxLength={50} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.email")}</span>
              <input type="email" maxLength={256} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
          </div>
          <div className="ws-form-row">
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.mrn")}</span>
              <input
                maxLength={50}
                value={form.mrn}
                onChange={(e) => setForm({ ...form, mrn: e.target.value })}
                onBlur={() => void checkDuplicates(form)}
              />
            </label>
            <label className="ws-field">
              <span className="ws-field-label">{t("patients.alerts")}</span>
              <input
                maxLength={2000}
                value={form.medicalAlerts}
                onChange={(e) => setForm({ ...form, medicalAlerts: e.target.value })}
              />
            </label>
          </div>

          {duplicates.length > 0 && (
            <div className="ws-duplicate-warning" role="status">
              <p>{t("patients.duplicatesFound")}</p>
              <ul>
                {duplicates.map((d) => (
                  <li key={d.id}>
                    {d.fullName} · {formatDate(d.dateOfBirth)} {d.externalMedicalRecordNumber ? `· ${d.externalMedicalRecordNumber}` : ""}
                  </li>
                ))}
              </ul>
              <p className="ws-muted">{t("patients.duplicatesHint")}</p>
            </div>
          )}

          {formError && (
            <p className="ws-error-text" role="alert">
              {formError}
            </p>
          )}

          <div className="ws-form-actions">
            <button type="submit" className="ws-button ws-button-primary" disabled={save.isPending}>
              {t("common.save")}
            </button>
            <button
              type="button"
              className="ws-button"
              onClick={() => {
                setForm(null);
                setFormError(null);
                setDuplicates([]);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {patientsQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : patientsQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void patientsQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (result?.items.length ?? 0) === 0 ? (
        <p className="ws-empty" aria-live="polite">
          {t("patients.empty")}
        </p>
      ) : (
        <>
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">{t("patients.fullName")}</th>
                <th scope="col">{t("patients.dob")}</th>
                <th scope="col">{t("patients.phone")}</th>
                <th scope="col">{t("patients.mrn")}</th>
                <th scope="col">{t("staff.status")}</th>
                <th scope="col">{t("patients.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {result!.items.map((p) => (
                <tr key={p.id} className={p.isActive ? undefined : "ws-row-revoked"}>
                  <td>
                    <Link to={`/patients/${p.id}`}>{p.fullName}</Link>
                  </td>
                  <td>{formatDate(p.dateOfBirth)}</td>
                  <td>{p.phone ?? "—"}</td>
                  <td>{p.externalMedicalRecordNumber ?? "—"}</td>
                  <td>{p.isActive ? t("staff.active") : t("patients.archived")}</td>
                  <td>
                    {canMutate && (
                      <>
                        <button type="button" className="ws-button ws-button-small" onClick={() => openEdit(p)}>
                          {t("patients.edit")}
                        </button>
                        {p.isActive ? (
                          <button
                            type="button"
                            className="ws-button ws-button-small ws-button-danger"
                            disabled={archive.isPending}
                            onClick={() => {
                              if (window.confirm(t("patients.confirmArchive"))) {
                                archive.mutate(p.id);
                              }
                            }}
                          >
                            {t("patients.archive")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ws-button ws-button-small"
                            disabled={restore.isPending}
                            onClick={() => restore.mutate(p.id)}
                          >
                            {t("patients.restore")}
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <nav className="ws-pagination" aria-label={t("patients.pagination")}>
            <button type="button" className="ws-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ‹
            </button>
            <span aria-live="polite">
              {page} / {totalPages}
            </span>
            <button type="button" className="ws-button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              ›
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
