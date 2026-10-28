using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Internal invoice over performed procedures (M07). All payments in the MVP are
/// explicitly SIMULATED demonstrations (INV-008) — no real money movement exists
/// anywhere in this flow. Totals are server-computed (INV-007).
/// </summary>
public sealed class Invoice : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid EncounterId { get; private set; }
    public string InvoiceNumber { get; private set; } = string.Empty;
    public decimal TotalAmount { get; private set; }
    public string Currency { get; private set; } = "UAH";
    public bool IsDemo => true;
    public InvoiceStatus Status { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public DateTime? VoidedAtUtc { get; private set; }
    public string? VoidReason { get; private set; }
    public bool HasLineSnapshot { get; private set; }

    private readonly List<InvoiceItem> _items = [];
    public IReadOnlyList<InvoiceItem> Items => _items.AsReadOnly();

    private readonly List<SimulatedPayment> _payments = [];
    public IReadOnlyList<SimulatedPayment> Payments => _payments;

    private Invoice()
    {
    }

    private Invoice(
        Guid id,
        Guid clinicId,
        Guid patientId,
        Guid encounterId,
        string invoiceNumber,
        decimal totalAmount,
        Guid createdByUserId,
        DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty) throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        if (patientId == Guid.Empty) throw new ArgumentException("Patient ID cannot be empty GUID.", nameof(patientId));
        if (encounterId == Guid.Empty) throw new ArgumentException("Encounter ID cannot be empty GUID.", nameof(encounterId));
        if (createdByUserId == Guid.Empty) throw new ArgumentException("Creator user ID cannot be empty GUID.", nameof(createdByUserId));
        if (string.IsNullOrWhiteSpace(invoiceNumber)) throw new ArgumentException("Invoice number is required.", nameof(invoiceNumber));
        if (totalAmount <= 0) throw new DomainException("An invoice total must be positive.");

        ClinicId = clinicId;
        PatientId = patientId;
        EncounterId = encounterId;
        InvoiceNumber = invoiceNumber.Trim();
        TotalAmount = decimal.Round(totalAmount, 2, MidpointRounding.ToEven);
        CreatedByUserId = createdByUserId;
        Status = InvoiceStatus.Issued;
    }

    public static Invoice Create(
        Guid clinicId, Guid patientId, Guid encounterId, string invoiceNumber,
        decimal totalAmount, Guid createdByUserId, DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, patientId, encounterId, invoiceNumber, totalAmount, createdByUserId, utcNow);

    public decimal SimulatedPaid() => _payments.Where(p => p.Status == SimulatedPaymentStatus.Recorded).Sum(p => p.Amount);

    public static Invoice Issue(
        Guid clinicId, Guid patientId, Guid encounterId, string invoiceNumber,
        IReadOnlyList<PerformedProcedure> procedures, IReadOnlyDictionary<Guid, ProcedureCatalogItem> catalog,
        Guid createdByUserId, DateTime utcNow)
    {
        if (procedures.Count == 0 || procedures.Select(p => p.Id).Distinct().Count() != procedures.Count ||
            procedures.Any(p => p.ClinicId != clinicId || p.PatientId != patientId || p.EncounterId != encounterId))
        {
            throw new DomainException("Invoice procedures must be distinct and belong to this clinic, patient and encounter.");
        }

        var invoice = Create(clinicId, patientId, encounterId, invoiceNumber, procedures.Sum(p => p.TotalAmount), createdByUserId, utcNow);
        foreach (var procedure in procedures)
        {
            invoice._items.Add(InvoiceItem.Capture(invoice.Id, procedure, catalog[procedure.ProcedureCatalogItemId], utcNow));
        }
        invoice.HasLineSnapshot = true;
        return invoice;
    }

    public decimal RemainingBalance() => TotalAmount - SimulatedPaid();

    /// <summary>FR-606: a simulated payment cannot exceed the remaining balance.</summary>
    public void AddSimulatedPayment(SimulatedPayment payment, DateTime utcNow)
    {
        if (payment.ClinicId != ClinicId || payment.InvoiceId != Id || payment.Amount <= 0 ||
            _payments.Any(p => p.IdempotencyKey == payment.IdempotencyKey))
        {
            throw new DomainException("Payment must be positive, unique and belong to this invoice and clinic.");
        }
        if (Status is InvoiceStatus.Voided)
        {
            throw new DomainException("A voided invoice cannot accept simulated payments.");
        }

        if (RemainingBalance() - payment.Amount < 0)
        {
            throw new DomainException(
                $"Simulated payment of {payment.Amount} exceeds the remaining balance of {RemainingBalance()}.");
        }

        _payments.Add(payment);

        if (RemainingBalance() == 0)
        {
            Status = InvoiceStatus.FullySimulated;
        }
        else
        {
            Status = InvoiceStatus.PartiallySimulated;
        }

        SetUpdatedTimestamp(utcNow);
    }

    public void Void(string reason, Guid voidedByUserId, DateTime utcNow)
    {
        if (SimulatedPaid() != 0)
        {
            throw new DomainException("An invoice with recorded simulated payments cannot be voided or reissued.");
        }
        if (voidedByUserId == Guid.Empty) throw new ArgumentException("Voiding user ID is required.", nameof(voidedByUserId));
        if (Status == InvoiceStatus.Voided)
        {
            throw new DomainException("Invoice is already voided.");
        }

        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new ArgumentException("Void reason is required.", nameof(reason));
        }

        Status = InvoiceStatus.Voided;
        VoidedAtUtc = utcNow;
        VoidReason = reason.Trim();
        SetUpdatedTimestamp(utcNow);
    }
}
