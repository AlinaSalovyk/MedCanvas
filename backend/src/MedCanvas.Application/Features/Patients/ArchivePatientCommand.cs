using MediatR;

namespace MedCanvas.Application.Features.Patients;

/// <summary>
/// Archive a patient (soft state). The clinical history stays intact and readable;
/// archived patients are excluded from the default list and cannot start new encounters.
/// </summary>
public sealed record ArchivePatientCommand(Guid PatientId) : IRequest<PatientDto>;
