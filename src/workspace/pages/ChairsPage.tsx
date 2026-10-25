import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";

/** Admin: dental chairs/resources management (M03). */
export function ChairsPage(): ReactNode {
  const { client, session, t } = useAuth();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chairsQuery = useQuery({
    queryKey: ["chairs", session?.clinicId],
    queryFn: () => client.getChairs(),
    enabled: Boolean(session),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["chairs"] });
  };

  const create = useMutation({
    mutationFn: () => client.createChair(newName),
    onSuccess: () => {
      setNewName("");
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => client.renameChair(id, name),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => client.setChairActive(id, active),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!create.isPending && newName.trim()) {
      create.mutate();
    }
  };

  return (
    <section>
      <h1>{t("chairs.title")}</h1>

      <form className="ws-card" onSubmit={onSubmit}>
        <label className="ws-field">
          <span className="ws-field-label">{t("chairs.name")}</span>
          <div className="ws-inline-row">
            <input required maxLength={100} value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button type="submit" className="ws-button ws-button-primary" disabled={create.isPending}>
              {t("chairs.add")}
            </button>
          </div>
        </label>
        {error && (
          <p className="ws-error-text" role="alert">
            {error}
          </p>
        )}
      </form>

      {chairsQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : chairsQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void chairsQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (chairsQuery.data?.length ?? 0) === 0 ? (
        <p className="ws-empty">{t("chairs.empty")}</p>
      ) : (
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">{t("chairs.name")}</th>
              <th scope="col">{t("staff.status")}</th>
              <th scope="col">{t("patients.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {chairsQuery.data!.map((chair) => (
              <tr key={chair.id} className={chair.isActive ? undefined : "ws-row-revoked"}>
                <td>
                  <input
                    aria-label={`${t("chairs.name")} ${chair.name}`}
                    defaultValue={chair.name}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      if (value && value !== chair.name) {
                        rename.mutate({ id: chair.id, name: value });
                      }
                    }}
                  />
                </td>
                <td>{chair.isActive ? t("staff.active") : t("chairs.deactivated")}</td>
                <td>
                  {chair.isActive ? (
                    <button
                      type="button"
                      className="ws-button ws-button-small ws-button-danger"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ id: chair.id, active: false })}
                    >
                      {t("chairs.deactivate")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ws-button ws-button-small"
                      disabled={setActive.isPending}
                      onClick={() => setActive.mutate({ id: chair.id, active: true })}
                    >
                      {t("chairs.activate")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
