namespace MedCanvas.Application.Features.Odontograms;

public sealed record OdontogramResponseDto(
    Guid Id,
    Guid ClinicId,
    Guid PatientId,
    Guid EncounterId,
    string PayloadVersion,
    string SnapshotJson,
    int ConcurrencyVersion,
    string ETag,
    bool IsFinalized,
    DateTime? FinalizedAtUtc,
    Guid? FinalizedByUserId,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
