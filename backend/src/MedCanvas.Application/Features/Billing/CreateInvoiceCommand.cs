using MediatR;

namespace MedCanvas.Application.Features.Billing;

/// <summary>
/// Generate an internal invoice from the encounter's non-voided recorded procedures.
/// Server computes the total (INV-007); already-invoiced procedures are never billed twice.
/// </summary>
public sealed record CreateInvoiceFromEncounterCommand(Guid EncounterId) : IRequest<InvoiceDto>;

/// <summary>Register a DEMO/SIMULATED payment. Idempotent per key (FR-607); concurrent-safe.</summary>
public sealed record RegisterSimulatedPaymentCommand(
    Guid InvoiceId,
    decimal Amount,
    string MethodLabel,
    string IdempotencyKey) : IRequest<InvoiceDto>;

public sealed record VoidInvoiceCommand(Guid InvoiceId, string Reason) : IRequest<InvoiceDto>;

public sealed record GetInvoiceQuery(Guid InvoiceId) : IRequest<InvoiceDto>;

public sealed record GetPatientInvoicesQuery(Guid PatientId) : IRequest<IReadOnlyList<InvoiceDto>>;
