using MediatR;

namespace MedCanvas.Application.Features.Patients;

/// <summary>Restore a previously archived patient to active care.</summary>
public sealed record RestorePatientCommand(Guid PatientId) : IRequest<PatientDto>;
