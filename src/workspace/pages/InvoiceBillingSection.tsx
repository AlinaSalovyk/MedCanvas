import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceDto } from "../../api/types";
import { useAuth } from "../AuthContext";

/** M07 demo billing section. Every operation is visibly marked as a SIMULATED
 *  demonstration (INV-008) — nothing here is real money. */
export function InvoiceBillingSection({ encounterId }: { encounterId: string }): ReactNode {
  const { session } = useAuth();
  const scope = `${session?.clinicId}:${session?.userId}:${encounterId}`;
  return <EncounterBilling key={scope} encounterId={encounterId} scope={scope} />;
}

interface PaymentIntent { invoiceId: string; amount: number; operationId: string }

function EncounterBilling({ encounterId, scope }: { encounterId: string; scope: string }): ReactNode {
  const { client, t, session } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const storageKey = `medcanvas.demo-payment:${scope}`;
  const [intent, setIntent] = useState<PaymentIntent | null>(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (stored && typeof stored === "object" && "invoiceId" in stored && typeof stored.invoiceId === "string" &&
          "amount" in stored && typeof stored.amount === "number" && stored.amount > 0 &&
          "operationId" in stored && typeof stored.operationId === "string") return stored as PaymentIntent;
    } catch { /* Unavailable storage: retain the operation in memory. */ }
    return null;
  });
  const pendingRef = useRef(false);

  // Invoices belong to the patient; the encounter's procedures drove them. We list
  // by the encounter's patient — resolved from the first performed procedure query.
  const invoicesQuery = useQuery({
    queryKey: ["invoices", session?.clinicId, encounterId],
    queryFn: async () => {
      // The billing API lists per patient; this panel is encounter-scoped, so we
      // filter client-side by encounter id after fetching the patient's invoices.
      const performed = await client.getEncounterPerformedProcedures(encounterId);
      if (performed.length === 0) return [];
      const invoices = await client.getPatientInvoices(performed[0].patientId);
      return invoices.filter((i) => i.encounterId === encounterId);
    },
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["invoices", session?.clinicId, encounterId] });
  };

  const issue = useMutation({
    mutationFn: () => client.createInvoiceFromEncounter(encounterId),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const pay = useMutation({
    mutationFn: (operation: PaymentIntent) =>
      client.registerSimulatedPayment(operation.invoiceId, operation.amount, operation.operationId),
    onSuccess: () => {
      setError(null);
      setIntent(null);
      try { sessionStorage.removeItem(storageKey); } catch { /* Retained in memory. */ }
      invalidate();
    },
    onError: (err: Error) => {
      setError(err.message);
      invalidate();
    },
    onSettled: () => { pendingRef.current = false; },
  });

  const submitPayment = (operation: PaymentIntent): void => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIntent(operation);
    try { sessionStorage.setItem(storageKey, JSON.stringify(operation)); } catch { /* Retained in memory. */ }
    pay.mutate(operation);
  };

  const voidInvoice = useMutation({
    mutationFn: (invoiceId: string) => client.voidInvoice(invoiceId, "Скасовано з робочого простору"),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

  const invoices = invoicesQuery.data ?? [];

  return (
    <div className="ws-billing-section">
      <h3>
        {t("billing.title")} <span className="ws-demo-badge">{t("billing.demoBadge")}</span>
      </h3>

      {error && (
        <p className="ws-error-text" role="alert">
          {error}
        </p>
      )}

      {invoicesQuery.isError && <p className="ws-error-text" role="alert">{t("common.error")}</p>}
      {intent && (
        <div role="status">
          <p>{t("billing.uncertain")}</p>
          <button type="button" className="ws-button" disabled={pay.isPending} onClick={() => submitPayment(intent)}>
            {t("billing.retryPayment")} ({intent.amount.toFixed(2)} UAH)
          </button>
        </div>
      )}
      {!invoicesQuery.isLoading && !invoicesQuery.isError && invoices.every(i => i.status === "Voided") && (
        <div>
          <p className="ws-empty">{t("billing.none")}</p>
          <button type="button" className="ws-button ws-button-primary" disabled={issue.isPending || Boolean(intent)} onClick={() => issue.mutate()}>
            {t("billing.issue")}
          </button>
        </div>
      )}
      {(
        invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            customAmount={customAmount}
            onCustomAmountChange={setCustomAmount}
            onPay={(amount) => {
              if (!intent) submitPayment({ invoiceId: invoice.id, amount, operationId: crypto.randomUUID() });
            }}
            onVoid={() => voidInvoice.mutate(invoice.id)}
            paying={pay.isPending || Boolean(intent) || voidInvoice.isPending}
          />
        ))
      )}
    </div>
  );
}

function InvoiceCard({
  invoice,
  customAmount,
  onCustomAmountChange,
  onPay,
  onVoid,
  paying,
}: {
  invoice: InvoiceDto;
  customAmount: string;
  onCustomAmountChange: (v: string) => void;
  onPay: (amount: number) => void;
  onVoid: () => void;
  paying: boolean;
}): ReactNode {
  const { t } = useAuth();
  const { session } = useAuth();
  const canPay = session?.role === "ClinicAdmin" || session?.role === "Assistant";

  return (
    <div className={`ws-invoice ${invoice.status === "Voided" ? "ws-row-revoked" : ""}`}>
      <div className="ws-invoice-header">
        <span>{invoice.invoiceNumber}</span>
        <span>{t(`billing.statuses.${invoice.status}`)}</span>
      </div>
      <dl className="ws-profile">
        <dt>{t("billing.total")}</dt>
        <dd>{invoice.totalAmount.toFixed(2)} UAH</dd>
        <dt>{t("billing.paid")}</dt>
        <dd>{invoice.simulatedPaid.toFixed(2)} UAH</dd>
        <dt>{t("billing.balance")}</dt>
        <dd>{invoice.remainingBalance.toFixed(2)} UAH</dd>
      </dl>
      {!invoice.hasLineSnapshot && <p role="alert">{t("billing.legacySnapshot")}</p>}

      {invoice.lines.length > 0 && (
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">{t("plans.item")}</th>
              <th scope="col">{t("plans.tooth")}</th>
              <th scope="col">{t("plans.qty")}</th>
              <th scope="col">{t("plans.total")}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr key={line.performedProcedureId}>
                <td>{line.catalogItemName}</td>
                <td>{line.toothFdi ?? "—"}</td>
                <td>{line.quantity}</td>
                <td>{line.totalAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canPay && invoice.hasLineSnapshot && invoice.status !== "Voided" && invoice.remainingBalance > 0 && (
        <div className="ws-form-actions">
          <button
            type="button"
            className="ws-button ws-button-primary"
            disabled={paying}
            onClick={() => onPay(invoice.remainingBalance)}
          >
            {t("billing.payFull")} ({invoice.remainingBalance.toFixed(2)})
          </button>
          <input
            type="number"
            min="0.01"
            max={invoice.remainingBalance}
            step="0.01"
            placeholder={t("billing.pay")}
            aria-label={t("billing.pay")}
            value={customAmount}
            onChange={(e) => onCustomAmountChange(e.target.value)}
            style={{ maxWidth: 140 }}
          />
          <button
            type="button"
            className="ws-button"
            disabled={paying || !customAmount || Number(customAmount) <= 0}
            onClick={() => onPay(Number(customAmount))}
          >
            {t("billing.pay")}
          </button>
        </div>
      )}

      {invoice.payments.length > 0 && (
        <details>
          <summary>
            {t("billing.payments")} ({invoice.payments.length})
          </summary>
          <ul>
            {invoice.payments.map((p) => (
              <li key={p.id}>
                {p.amount.toFixed(2)} UAH · {p.methodLabel} · {p.status === "Voided" ? t("performed.voided") : t("performed.recorded")}
              </li>
            ))}
          </ul>
        </details>
      )}

      {invoice.status !== "Voided" && invoice.simulatedPaid === 0 && (
        <button type="button" className="ws-button ws-button-small ws-button-danger" disabled={paying} onClick={onVoid}>
          {t("billing.void")}
        </button>
      )}
    </div>
  );
}
