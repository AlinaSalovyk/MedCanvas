using MediatR;

namespace MedCanvas.Application.Features.Patients;

public sealed record CreatePatientCommand(
    string FirstName,
    string LastName,
    DateOnly? DateOfBirth = null,
    string? Gender = null,
    string? Phone = null,
    string? Email = null,
    string? ExternalMedicalRecordNumber = null,
    string? MedicalAlerts = null) : IRequest<PatientDto>;
