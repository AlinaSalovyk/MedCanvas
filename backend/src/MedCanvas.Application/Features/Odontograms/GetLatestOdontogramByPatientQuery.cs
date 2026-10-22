using MediatR;

namespace MedCanvas.Application.Features.Odontograms;

public sealed record GetLatestOdontogramByPatientQuery(Guid PatientId) : IRequest<OdontogramResponseDto>;
