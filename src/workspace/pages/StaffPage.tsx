import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClinicMemberDto } from "../../api/types";
import { useAuth } from "../AuthContext";

const ROLES = ["ClinicAdmin", "Clinician", "Assistant", "Viewer"] as const;

export function StaffPage(): ReactNode {
  const { client, session, t } = useAuth();
  const queryClient = useQueryClient();

  const [addError, setAddError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<string>("Clinician");

  const membersQuery = useQuery({
    queryKey: ["clinic-members", session?.clinicId],
    queryFn: () => client.getClinicMembers(),
    enabled: Boolean(session),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["clinic-members"] });
  };

  const addMember = useMutation({
    mutationFn: () =>
      client.addClinicMember({ email: newEmail, fullName: newFullName, password: newPassword, role: newRole }),
    onSuccess: () => {
      setNewEmail("");
      setNewFullName("");
      setNewPassword("");
      setNewRole("Clinician");
      setAddError(null);
      invalidate();
    },
    onError: (err: Error) => setAddError(err.message),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => client.changeMemberRole(userId, role),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => client.revokeClinicMember(userId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const activate = useMutation({
    mutationFn: (userId: string) => client.activateClinicMember(userId),
    onSuccess: () => {
      setActionError(null);
      invalidate();
    },
    onError: (err: Error) => setActionError(err.message),
  });

  const onAdd = (e: FormEvent): void => {
    e.preventDefault();
    if (addMember.isPending) {
      return;
    }
    addMember.mutate();
  };

  const members: ClinicMemberDto[] = membersQuery.data ?? [];

  return (
    <section>
      <h1>{t("staff.title")}</h1>

      <form className="ws-card ws-add-member" onSubmit={onAdd}>
        <h2>{t("staff.add")}</h2>
        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("staff.fullName")}</span>
            <input required maxLength={200} value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("staff.email")}</span>
            <input
              type="email"
              required
              maxLength={256}
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </label>
        </div>
        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("staff.password")}</span>
            <input
              type="password"
              required
              minLength={8}
              maxLength={100}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("staff.role")}</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {addError && (
          <p className="ws-error-text" role="alert">
            {addError}
          </p>
        )}
        <button type="submit" className="ws-button ws-button-primary" disabled={addMember.isPending}>
          {t("staff.add")}
        </button>
      </form>

      {actionError && (
        <p className="ws-error-text" role="alert">
          {actionError}
        </p>
      )}

      {membersQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : membersQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void membersQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : members.length === 0 ? (
        <p className="ws-empty" aria-live="polite">
          {t("staff.empty")}
        </p>
      ) : (
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">{t("staff.fullName")}</th>
              <th scope="col">{t("staff.email")}</th>
              <th scope="col">{t("staff.role")}</th>
              <th scope="col">{t("staff.status")}</th>
              <th scope="col">{t("staff.changeRole")}</th>
              <th scope="col">{t("staff.revoke")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.userId === session?.userId;
              return (
                <tr key={m.userId} className={m.membershipActive ? undefined : "ws-row-revoked"}>
                  <td>
                    {m.fullName}
                    {isSelf && <span className="ws-muted"> · {t("staff.selfNote")}</span>}
                  </td>
                  <td>{m.email}</td>
                  <td>{t(`role.${m.role}`)}</td>
                  <td>{m.membershipActive ? t("staff.active") : t("staff.revoked")}</td>
                  <td>
                    <select
                      aria-label={`${t("staff.changeRole")} — ${m.fullName}`}
                      value={m.role}
                      disabled={isSelf || changeRole.isPending}
                      onChange={(e) => changeRole.mutate({ userId: m.userId, role: e.target.value })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`role.${r}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {m.membershipActive ? (
                      <button
                        type="button"
                        className="ws-button ws-button-danger"
                        disabled={isSelf || revoke.isPending}
                        onClick={() => {
                          if (window.confirm(t("staff.confirmRevoke"))) {
                            revoke.mutate(m.userId);
                          }
                        }}
                      >
                        {t("staff.revoke")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ws-button"
                        disabled={activate.isPending}
                        onClick={() => activate.mutate(m.userId)}
                      >
                        {t("staff.activate")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
