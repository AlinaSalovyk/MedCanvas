import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TreatmentPlanDto } from "../../api/types";
import { useAuth } from "../AuthContext";

/** Patient treatment plans (M05): create from an encounter, add items with price
 *  snapshots, submit, approve — server-computed estimate everywhere. */
export function TreatmentPlansPage(): ReactNode {
  const { client, session, t } = useAuth();
  const { patientId } = useParams<{ patientId: string }>();
  const queryClient = useQueryClient();

  const canPlan = session?.role === "ClinicAdmin" || session?.role === "Clinician";

  const plansQuery = useQuery({
    queryKey: ["treatment-plans", session?.clinicId, patientId],
    queryFn: () => client.getPatientTreatmentPlans(patientId!),
    enabled: Boolean(patientId),
  });

  const [selectedEncounterId, setSelectedEncounterId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const encountersQuery = useQuery({
    queryKey: ["patient-encounters", session?.clinicId, patientId],
    queryFn: () => client.getPatientEncounters(patientId!),
    enabled: Boolean(patientId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
  };

  const createPlan = useMutation({
    mutationFn: () => client.createTreatmentPlan(patientId!, selectedEncounterId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const submitPlan = useMutation({
    mutationFn: (planId: string) => client.submitTreatmentPlan(planId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const approvePlan = useMutation({
    mutationFn: (planId: string) => client.approveTreatmentPlan(planId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const cancelPlan = useMutation({
    mutationFn: (planId: string) => client.cancelTreatmentPlan(planId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const onCreate = (e: FormEvent): void => {
    e.preventDefault();
    if (selectedEncounterId) {
      createPlan.mutate();
    }
  };

  return (
    <section>
      <div className="ws-page-header">
        <h1>{t("plans.title")}</h1>
        <Link to={`/patients/${patientId}`} className="ws-button">
          {t("patients.backToList")}
        </Link>
      </div>

      {canPlan && (
        <form className="ws-card" onSubmit={onCreate}>
          <label className="ws-field">
            <span className="ws-field-label">{t("plans.sourceEncounter")}</span>
            <select required value={selectedEncounterId} onChange={(e) => setSelectedEncounterId(e.target.value)}>
              <option value="">—</option>
              {(encountersQuery.data ?? [])
                .filter((enc) => enc.status === "InProgress")
                .map((enc) => (
                  <option key={enc.id} value={enc.id}>
                    {new Date(enc.startedAtUtc).toLocaleString()} · {enc.chiefComplaint ?? enc.status}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" className="ws-button ws-button-primary" disabled={createPlan.isPending || !selectedEncounterId}>
            {t("plans.create")}
          </button>
        </form>
      )}

      {error && (
        <p className="ws-error-text" role="alert">
          {error}
        </p>
      )}

      {plansQuery.isLoading ? (
        <p aria-live="polite">{t("common.loading")}</p>
      ) : plansQuery.isError ? (
        <div role="alert">
          <p className="ws-error-text">{t("common.error")}</p>
          <button type="button" className="ws-button" onClick={() => void plansQuery.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : (plansQuery.data?.length ?? 0) === 0 ? (
        <p className="ws-empty">{t("plans.empty")}</p>
      ) : (
        plansQuery.data!.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            canPlan={canPlan}
            onSubmit={() => submitPlan.mutate(plan.id)}
            onApprove={() => approvePlan.mutate(plan.id)}
            onCancel={() => cancelPlan.mutate(plan.id)}
            submitting={submitPlan.isPending}
            approving={approvePlan.isPending}
            cancelling={cancelPlan.isPending}
          />
        ))
      )}
    </section>
  );
}

function PlanCard({
  plan,
  canPlan,
  onSubmit,
  onApprove,
  onCancel,
  submitting,
  approving,
  cancelling,
}: {
  plan: TreatmentPlanDto;
  canPlan: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onCancel: () => void;
  submitting: boolean;
  approving: boolean;
  cancelling: boolean;
}): ReactNode {
  const { client, t } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [catalogItemId, setCatalogItemId] = useState("");
  const [tooth, setTooth] = useState("");
  const [phase, setPhase] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["catalog"],
    queryFn: () => client.getCatalogItems(),
    enabled: showAdd,
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
  };

  const addItem = useMutation({
    mutationFn: () =>
      client.addPlanItem(plan.id, {
        catalogItemId,
        toothFdi: tooth || null,
        phase: phase || null,
        quantity: Number(quantity),
      }),
    onSuccess: () => {
      setCatalogItemId("");
      setTooth("");
      setPhase("");
      setQuantity("1");
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => client.removePlanItem(plan.id, itemId),
    onSuccess: () => invalidate(),
    onError: (err: Error) => setError(err.message),
  });

  const onAddItem = (e: FormEvent): void => {
    e.preventDefault();
    if (addItem.isPending && catalogItemId) {
      return;
    }
    addItem.mutate();
  };

  return (
    <div className="ws-card ws-card-wide">
      <div className="ws-page-header">
        <h2>
          {t("plans.title")} #{plan.id.slice(0, 8)} · {t(`plans.statuses.${plan.status}`)}
        </h2>
        <span className="ws-plan-total" data-testid="plan-total">
          {t("plans.total")}: {plan.estimateTotal.toFixed(2)} UAH
        </span>
      </div>

      {plan.items.length === 0 ? (
        <p className="ws-empty">{t("plans.noItems")}</p>
      ) : (
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">{t("plans.item")}</th>
              <th scope="col">{t("patients.dob")}</th>
              <th scope="col">{t("plans.tooth")}</th>
              <th scope="col">{t("plans.phase")}</th>
              <th scope="col">{t("plans.qty")}</th>
              <th scope="col">{t("plans.unitPrice")}</th>
              <th scope="col">{t("plans.total")}</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item) => (
              <tr key={item.id}>
                <td>{item.catalogItemName}</td>
                <td>{new Date(plan.createdAtUtc).toLocaleDateString()}</td>
                <td>{item.toothFdi ?? "—"}</td>
                <td>{item.phase ?? "—"}</td>
                <td>{item.quantity}</td>
                <td>{item.unitPriceSnapshot.toFixed(2)}</td>
                <td>{item.totalAmount.toFixed(2)}</td>
                <td>
                  {plan.status === "Draft" && canPlan && (
                    <button
                      type="button"
                      className="ws-button ws-button-small ws-button-danger"
                      onClick={() => removeItem.mutate(item.id)}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {error && (
        <p className="ws-error-text" role="alert">
          {error}
        </p>
      )}

      {plan.status === "Draft" && canPlan && (
        <>
          {showAdd ? (
            <form className="ws-inline-form" onSubmit={onAddItem}>
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
                <span className="ws-field-label">{t("plans.phase")}</span>
                <input maxLength={100} value={phase} onChange={(e) => setPhase(e.target.value)} />
              </label>
              <label className="ws-field ws-field-narrow">
                <span className="ws-field-label">{t("plans.qty")}</span>
                <input type="number" min="1" max="20" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
              <div className="ws-form-actions">
                <button type="submit" className="ws-button ws-button-primary" disabled={addItem.isPending || !catalogItemId}>
                  {t("plans.addItem")}
                </button>
                <button type="button" className="ws-button" onClick={() => setShowAdd(false)}>
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          ) : (
            <div className="ws-form-actions">
              <button type="button" className="ws-button" onClick={() => setShowAdd(true)}>
                {t("plans.addItem")}
              </button>
              <button
                type="button"
                className="ws-button ws-button-primary"
                disabled={submitting}
                onClick={onSubmit}
              >
                {t("plans.submit")}
              </button>
              <button type="button" className="ws-button ws-button-danger" onClick={onCancel}>
                {t("calendar.cancel")}
              </button>
            </div>
          )}
        </>
      )}

      {plan.status === "Proposed" && canPlan && (
        <div className="ws-form-actions">
          <button type="button" className="ws-button ws-button-primary" disabled={approving} onClick={onApprove}>
            {t("plans.approve")}
          </button>
          <button type="button" className="ws-button ws-button-danger" disabled={cancelling} onClick={onCancel}>
            {t("calendar.cancel")}
          </button>
        </div>
      )}
    </div>
  );
}
