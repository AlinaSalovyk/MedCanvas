namespace MedCanvas.Application.Features.Odontograms;

public sealed record OdontogramRevisionDto(
    Guid Id,
    Guid OdontogramRecordId,
    int RevisionNumber,
    string SnapshotJson,
    Guid CreatedByUserId,
    string? ChangeSummary,
    DateTime CreatedAtUtc);
