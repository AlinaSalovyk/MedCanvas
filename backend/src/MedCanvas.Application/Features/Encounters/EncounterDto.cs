namespace MedCanvas.Application.Features.Encounters;

public sealed record EncounterDto(
    Guid Id,
    Guid ClinicId,
    Guid PatientId,
    Guid AttendingUserId,
    DateTime EncounterDateUtc,
    string? ChiefComplaint,
    string? ClinicalNotes,
    string Status,
    Guid? AppointmentId,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
