namespace MedCanvas.Domain.Exceptions;

/// <summary>
/// Thrown when attempting to update or modify an OdontogramRecord that has been legally finalized and signed.
/// </summary>
public sealed class RecordFinalizedException : DomainException
{
    public Guid RecordId { get; }

    public RecordFinalizedException(Guid recordId)
        : base($"Odontogram record with ID '{recordId}' has been finalized and is immutable.")
    {
        RecordId = recordId;
    }
}
