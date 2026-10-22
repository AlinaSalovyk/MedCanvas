namespace MedCanvas.Application.Features.Patients;

public sealed record PatientDto(
    Guid Id,
    Guid ClinicId,
    string FirstName,
    string LastName,
    string FullName,
    DateOnly? DateOfBirth,
    string? Gender,
    string? Phone,
    string? Email,
    string? ExternalMedicalRecordNumber,
    string? MedicalAlerts,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
