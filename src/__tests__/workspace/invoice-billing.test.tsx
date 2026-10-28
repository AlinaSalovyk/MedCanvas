import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InvoiceBillingSection } from "../../workspace/pages/InvoiceBillingSection";
import type { InvoiceDto } from "../../api/types";

const mocks = vi.hoisted(() => ({
  getEncounterPerformedProcedures: vi.fn(), getPatientInvoices: vi.fn(), registerSimulatedPayment: vi.fn(),
  createInvoiceFromEncounter: vi.fn(), voidInvoice: vi.fn(),
}));
vi.mock("../../workspace/AuthContext", () => ({ useAuth: () => ({
  client: mocks, session: { clinicId: "clinic-a", userId: "admin", role: "ClinicAdmin" }, t: (key: string) => key,
}) }));

const invoice: InvoiceDto = {
  id: "invoice-1", clinicId: "clinic-a", patientId: "patient-1", patientFullName: "Synthetic",
  encounterId: "encounter-1", invoiceNumber: "INV-1", totalAmount: 1000, currency: "UAH", status: "Issued",
  simulatedPaid: 0, remainingBalance: 1000, isDemo: true, hasLineSnapshot: true, lines: [], payments: [], createdAtUtc: "2026-10-28",
};
function mount(): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><InvoiceBillingSection encounterId="encounter-1" /></QueryClientProvider>);
}

describe("simulated payment intent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    mocks.getEncounterPerformedProcedures.mockResolvedValue([{ patientId: "patient-1" }]);
    mocks.getPatientInvoices.mockResolvedValue([invoice]);
  });

  it("retains the exact key and amount after an uncertain result and component reload", async () => {
    mocks.registerSimulatedPayment.mockRejectedValueOnce(new Error("timeout"));
    const view = mount();
    fireEvent.change(await screen.findByLabelText("billing.pay"), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "billing.pay" }));
    await screen.findByText("timeout");
    expect(mocks.registerSimulatedPayment).toHaveBeenCalledTimes(1);
    const original = mocks.registerSimulatedPayment.mock.calls[0];
    view.unmount();
    mount();
    mocks.registerSimulatedPayment.mockResolvedValueOnce({ ...invoice, simulatedPaid: 400, remainingBalance: 600 });
    fireEvent.click(await screen.findByRole("button", { name: /billing.retryPayment/ }));
    await waitFor(() => expect(mocks.registerSimulatedPayment).toHaveBeenCalledTimes(2));
    expect(mocks.registerSimulatedPayment.mock.calls[1]).toEqual(original);
    expect(original.slice(0, 2)).toEqual(["invoice-1", 400]);
    await waitFor(() => expect(screen.queryByRole("button", { name: /billing.retryPayment/ })).toBeNull());
    expect(sessionStorage.length).toBe(0);
  });

  it("blocks duplicate clicks and new payments while confirmation is pending", async () => {
    let confirm!: (value: InvoiceDto) => void;
    mocks.registerSimulatedPayment.mockImplementation(() => new Promise<InvoiceDto>(resolve => { confirm = resolve; }));
    mount();
    const pay = await screen.findByRole("button", { name: /billing.payFull/ });
    fireEvent.click(pay);
    fireEvent.click(pay);
    await waitFor(() => expect(mocks.registerSimulatedPayment).toHaveBeenCalledTimes(1));
    expect(pay).toBeDisabled();
    expect(screen.getByRole("button", { name: /billing.retryPayment/ })).toBeDisabled();
    confirm({ ...invoice, status: "FullySimulated", simulatedPaid: 1000, remainingBalance: 0 });
    await waitFor(() => expect(screen.queryByRole("button", { name: /billing.retryPayment/ })).toBeNull());
  });

  it("does not offer payment for legacy invoices without historical lines", async () => {
    mocks.getPatientInvoices.mockResolvedValue([{ ...invoice, hasLineSnapshot: false }]);
    mount();
    await screen.findByText("billing.legacySnapshot");
    expect(screen.queryByRole("button", { name: /billing.payFull/ })).toBeNull();
  });
});
