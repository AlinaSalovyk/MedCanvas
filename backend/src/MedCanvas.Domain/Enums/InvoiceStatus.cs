namespace MedCanvas.Domain.Enums;

/// <summary>Invoice lifecycle. All payment states are explicitly SIMULATED (INV-008).</summary>
public enum InvoiceStatus
{
    Issued = 0,
    PartiallySimulated = 1,
    FullySimulated = 2,
    Voided = 3,
}

public enum SimulatedPaymentStatus
{
    Recorded = 0,
    Voided = 1,
}
