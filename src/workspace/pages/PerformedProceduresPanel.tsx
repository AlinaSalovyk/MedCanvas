import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../AuthContext";

/** M06: performed-procedures panel on the encounter workspace. Every entry is an
 *  explicit clinician action with an idempotency key; corrections are voids. */
export function PerformedProceduresPanel({ encounterId }: { encounterId: string }): ReactNode {
  const { client, t } = useAuth();
  const queryClient = useQueryClient();

  const [catalogItemId, setCatalogItemId] = useState("");
  const [tooth, setTooth] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["catalog"],
    queryFn: () => client.getCatalogItems(),
  });

  const performedQuery = useQuery({
    queryKey: ["performed", encounterId],
    queryFn: () => client.getEncounterPerformedProcedures(encounterId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["performed"] });
    void queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
  };

  const record = useMutation({
    mutationFn: () =>
      client.recordPerformedProcedure(encounterId, {
        catalogItemId,
        idempotencyKey: crypto.randomUUID(),
        toothFdi: tooth || null,
        quantity: Number(quantity),
        clinicalNote: note || null,
      }),
    onSuccess: () => {
      setCatalogItemId("");
      setTooth("");
      setQuantity("1");
      setNote("");
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const voidProc = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => client.voidPerformedProcedure(id, reason),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const onRecord = (e: FormEvent): void => {
    e.preventDefault();
    if (record.isPending || !catalogItemId) return;
    record.mutate();
  };

  const onVoid = (id: string): void => {
    const reason = window.prompt(t("performed.voidReason"));
    if (reason) {
      voidProc.mutate({ id, reason });
    }
  };

  const performed = performedQuery.data ?? [];
  const billedTotal = performed
    .filter((p) => p.status === "Recorded")
    .reduce((sum, p) => sum + p.totalAmount, 0);

  return (
    <div className="ws-card ws-card-wide ws-performed">
      <h2>
        {t("performed.title")}
        <span className="ws-plan-total"> · {billedTotal.toFixed(2)} UAH</span>
      </h2>

      <form className="ws-inline-form" onSubmit={onRecord}>
        <div className="ws-form-row">
          <label className="ws-field">
            <span className="ws-field-label">{t("plans.item")}</span>
            <select required value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
              <option value="">—</option>
              {(catalogQuery.data ?? [])
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.defaultPrice.toFixed(2)} UAH
                  </option>
                ))}
            </select>
          </label>
          <label className="ws-field ws-field-narrow">
            <span className="ws-field-label">{t("plans.tooth")}</span>
            <input maxLength={2} pattern="[1-4][1-8]|5[1-5]|[6-8][1-5]" value={tooth} onChange={(e) => setTooth(e.target.value)} />
          </label>
          <label className="ws-field ws-field-narrow">
            <span className="ws-field-label">{t("plans.qty")}</span>
            <input type="number" min="1" max="20" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </label>
          <label className="ws-field">
            <span className="ws-field-label">{t("performed.note")}</span>
            <input maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        {error && (
          <p className="ws-error-text" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="ws-button ws-button-primary" disabled={record.isPending || !catalogItemId}>
          {t("performed.record")}
        </button>
      </form>

      {performed.length === 0 ? (
        <p className="ws-empty">{t("performed.empty")}</p>
      ) : (
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">{t("plans.item")}</th>
              <th scope="col">{t("plans.tooth")}</th>
              <th scope="col">{t("plans.qty")}</th>
              <th scope="col">{t("plans.total")}</th>
              <th scope="col">{t("staff.status")}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {performed.map((p) => (
              <tr key={p.id} className={p.status === "Voided" ? "ws-row-revoked" : undefined}>
                <td>{p.catalogItemName}</td>
                <td>{p.toothFdi ?? "—"}</td>
                <td>{p.quantity}</td>
                <td>{p.totalAmount.toFixed(2)}</td>
                <td>{p.status === "Recorded" ? t("performed.recorded") : t("performed.voided")}</td>
                <td>
                  {p.status === "Recorded" && (
                    <button
                      type="button"
                      className="ws-button ws-button-small ws-button-danger"
                      onClick={() => onVoid(p.id)}
                    >
                      {t("performed.void")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
