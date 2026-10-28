using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// A DEMO/SIMULATED payment record against an invoice. IsSimulation is a constant
/// true — these records can never represent real money movement (INV-008, FR-607).
/// </summary>
public sealed class SimulatedPayment : BaseEntity
{
    public Guid ClinicId { get; private set; }
    public Guid InvoiceId { get; private set; }
    public decimal Amount { get; private set; }
    public string MethodLabel { get; private set; } = string.Empty;
    public string IdempotencyKey { get; private set; } = string.Empty;
    public bool IsSimulation { get; private set; }
    public SimulatedPaymentStatus Status { get; private set; }
    public string? VoidReason { get; private set; }
    public Guid RecordedByUserId { get; private set; }

    private SimulatedPayment()
    {
    }

    private SimulatedPayment(
        Guid id,
        Guid clinicId,
        Guid invoiceId,
        decimal amount,
        string methodLabel,
        string idempotencyKey,
        Guid recordedByUserId,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty) throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        if (invoiceId == Guid.Empty) throw new ArgumentException("Invoice ID cannot be empty GUID.", nameof(invoiceId));
        if (amount <= 0) throw new ArgumentException("Simulated payment amount must be positive.", nameof(amount));
        if (amount > 999_999m || decimal.Round(amount, 2) != amount)
            throw new ArgumentException("Simulated payments must use at most two decimal places and not exceed 999 999 UAH.", nameof(amount));
        if (string.IsNullOrWhiteSpace(methodLabel)) throw new ArgumentException("Method label is required.", nameof(methodLabel));
        if (string.IsNullOrWhiteSpace(idempotencyKey)) throw new ArgumentException("Idempotency key is required.", nameof(idempotencyKey));
        if (recordedByUserId == Guid.Empty) throw new ArgumentException("Recorder user ID cannot be empty GUID.", nameof(recordedByUserId));

        ClinicId = clinicId;
        InvoiceId = invoiceId;
        Amount = decimal.Round(amount, 2, MidpointRounding.ToEven);
        MethodLabel = methodLabel.Trim();
        IdempotencyKey = idempotencyKey.Trim();
        IsSimulation = true;
        RecordedByUserId = recordedByUserId;
        Status = SimulatedPaymentStatus.Recorded;
    }

    public static SimulatedPayment Record(
        Guid clinicId, Guid invoiceId, decimal amount, string methodLabel,
        string idempotencyKey, Guid recordedByUserId, DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, invoiceId, amount, methodLabel, idempotencyKey, recordedByUserId, utcNow);

    public void Void(string reason, DateTime utcNow)
    {
        if (Status != SimulatedPaymentStatus.Recorded)
        {
            throw new Domain.Exceptions.DomainException("Simulated payment is already voided.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Void reason is required.", nameof(reason));
        }

        Status = SimulatedPaymentStatus.Voided;
        VoidReason = reason.Trim();
        SetUpdatedTimestamp(utcNow);
    }
}
