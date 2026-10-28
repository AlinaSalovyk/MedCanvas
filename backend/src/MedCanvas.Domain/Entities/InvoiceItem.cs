using MedCanvas.Domain.Common;
using MedCanvas.Domain.Enums;
using MedCanvas.Domain.Exceptions;

namespace MedCanvas.Domain.Entities;

/// <summary>Immutable financial snapshot. Source procedure/catalog mutations never
/// alter an issued line; corrections require voiding the unpaid invoice and reissue.</summary>
public sealed class InvoiceItem : BaseEntity
{
    public Guid InvoiceId { get; private set; }
    public Guid PerformedProcedureId { get; private set; }
    public string CodeSnapshot { get; private set; } = string.Empty;
    public string DescriptionSnapshot { get; private set; } = string.Empty;
    public string? ToothFdi { get; private set; }
    public int Quantity { get; private set; }
    public decimal UnitPriceSnapshot { get; private set; }
    public decimal TotalAmount { get; private set; }

    private InvoiceItem() { }

    private InvoiceItem(Guid invoiceId, PerformedProcedure procedure, ProcedureCatalogItem catalog, DateTime utcNow)
        : base(Guid.NewGuid(), utcNow)
    {
        if (invoiceId == Guid.Empty) throw new ArgumentException("Invoice ID is required.", nameof(invoiceId));
        if (procedure.Status != PerformedProcedureStatus.Recorded ||
            procedure.ProcedureCatalogItemId != catalog.Id || procedure.ClinicId != catalog.ClinicId)
        {
            throw new DomainException("Invoice lines require a recorded procedure and its clinic's catalog item.");
        }

        InvoiceId = invoiceId;
        PerformedProcedureId = procedure.Id;
        CodeSnapshot = catalog.Code;
        DescriptionSnapshot = catalog.Name;
        ToothFdi = procedure.ToothFdi;
        Quantity = procedure.Quantity;
        UnitPriceSnapshot = procedure.UnitPriceSnapshot;
        TotalAmount = procedure.TotalAmount;
    }

    internal static InvoiceItem Capture(Guid invoiceId, PerformedProcedure procedure, ProcedureCatalogItem catalog, DateTime utcNow) =>
        new(invoiceId, procedure, catalog, utcNow);
}
