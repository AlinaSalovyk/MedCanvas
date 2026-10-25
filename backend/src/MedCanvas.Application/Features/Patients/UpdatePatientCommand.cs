using MediatR;

namespace MedCanvas.Application.Features.Patients;

public sealed record UpdatePatientCommand(
    Guid Id,
    string FirstName,
    string LastName,
    DateOnly? DateOfBirth = null,
    string? Gender = null,
    string? Phone = null,
    string? Email = null,
    string? ExternalMedicalRecordNumber = null,
    string? MedicalAlerts = null,
    int? ExpectedVersion = null) : IRequest<PatientDto>;
