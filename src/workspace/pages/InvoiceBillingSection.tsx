import { useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceDto } from "../../api/types";
import { useAuth } from "../AuthContext";

/** M07 demo billing section. Every operation is visibly marked as a SIMULATED
 *  demonstration (INV-008) — nothing here is real money. */
export function InvoiceBillingSection({ encounterId }: { encounterId: string }): ReactNode {
  const { client, t } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  // Invoices belong to the patient; the encounter's procedures drove them. We list
  // by the encounter's patient — resolved from the first performed procedure query.
  const invoicesQuery = useQuery({
    queryKey: ["invoices", encounterId],
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
    void queryClient.invalidateQueries({ queryKey: ["invoices"] });
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
    mutationFn: ({ invoiceId, amount }: { invoiceId: string; amount: number }) =>
      client.registerSimulatedPayment(invoiceId, amount, crypto.randomUUID()),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: Error) => setError(err.message),
  });

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

      {invoices.length === 0 ? (
        <div>
          <p className="ws-empty">{t("billing.none")}</p>
          <button type="button" className="ws-button ws-button-primary" disabled={issue.isPending} onClick={() => issue.mutate()}>
            {t("billing.issue")}
          </button>
        </div>
      ) : (
        invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            customAmount={customAmount}
            onCustomAmountChange={setCustomAmount}
            onPay={(amount) => pay.mutate({ invoiceId: invoice.id, amount })}
            onVoid={() => voidInvoice.mutate(invoice.id)}
            paying={pay.isPending}
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

      {invoice.status !== "Voided" && invoice.remainingBalance > 0 && (
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

      {invoice.status !== "Voided" && (
        <button type="button" className="ws-button ws-button-small ws-button-danger" onClick={onVoid}>
          {t("billing.void")}
        </button>
      )}
    </div>
  );
}
