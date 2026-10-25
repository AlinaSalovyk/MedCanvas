import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";

/** Admin: clinic price list (M05). */
export function CatalogPage(): ReactNode {
  const { client, session, t } = useAuth();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("0");
  const [duration, setDuration] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const itemsQuery = useQuery({
    queryKey: ["catalog", session?.clinicId],
    queryFn: () => client.getCatalogItems(),
    enabled: Boolean(session),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["catalog"] });
  };

  const create = useMutation({
    mutationFn: () =>
      client.createCatalogItem({
        code,
        name,
        category: category || null,
        defaultPrice: Number(price),
        estimatedDurationMinutes: Number(duration),
      }),
    onSuccess: () => {
      setCode("");
      setName("");
      setCategory("");
      setPrice("0");
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => client.setCatalogItemActive(id, active),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (!create.isPending && code.trim() && name.trim()) {
      create.mutate();
    }
  };

  return (
    <section>
      <h1>{t("catalog.title")}</h1>

      <form className="ws-card" onSubmit={onSubmit}>
        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("catalog.code")}</span>
            <input required minLength={2} maxLength={50} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("catalog.name")}</span>
            <input required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("catalog.category")}</span>
            <input maxLength={100} value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("catalog.price")} (UAH)</span>
            <input type="number" min="0" max="999999" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("catalog.duration")}</span>
            <input type="number" min="0" max="600" required value={duration} onChange={(e) => setDuration(e.target.value)} />
          </label>
        </div>
        {error && (
          <p className="ws-error-text" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="ws-button ws-button-primary" disabled={create.isPending}>
          {t("catalog.add")}
        </button>
      </form>

      {itemsQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : itemsQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void itemsQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (itemsQuery.data?.length ?? 0) === 0 ? (
        <p className="ws-empty">{t("catalog.empty")}</p>
      ) : (
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">{t("catalog.code")}</th>
              <th scope="col">{t("catalog.name")}</th>
              <th scope="col">{t("catalog.category")}</th>
              <th scope="col">{t("catalog.price")}</th>
              <th scope="col">{t("staff.status")}</th>
              <th scope="col">{t("patients.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {itemsQuery.data!.map((item) => (
              <tr key={item.id} className={item.isActive ? undefined : "ws-row-revoked"}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.category ?? "—"}</td>
                <td>{item.defaultPrice.toFixed(2)}</td>
                <td>{item.isActive ? t("staff.active") : t("chairs.deactivated")}</td>
                <td>
                  {item.isActive ? (
                    <button
                      type="button"
                      className="ws-button ws-button-small ws-button-danger"
                      onClick={() => setActive.mutate({ id: item.id, active: false })}
                    >
                      {t("chairs.deactivate")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ws-button ws-button-small"
                      onClick={() => setActive.mutate({ id: item.id, active: true })}
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
