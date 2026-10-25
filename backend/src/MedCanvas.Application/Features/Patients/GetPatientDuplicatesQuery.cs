using MediatR;

namespace MedCanvas.Application.Features.Patients;

/// <summary>
/// Duplicate hint (FR-106): probable matches by MRN or by full name + date of birth.
/// Read-only advisory — medical histories are never merged automatically.
/// </summary>
public sealed record GetPatientDuplicatesQuery(
    string? FirstName = null,
    string? LastName = null,
    DateOnly? DateOfBirth = null,
    string? ExternalMedicalRecordNumber = null) : IRequest<IReadOnlyList<PatientDto>>;
