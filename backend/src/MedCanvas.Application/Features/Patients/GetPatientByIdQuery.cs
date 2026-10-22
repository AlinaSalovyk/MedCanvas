using MediatR;

namespace MedCanvas.Application.Features.Patients;

public sealed record GetPatientByIdQuery(Guid Id) : IRequest<PatientDto>;
