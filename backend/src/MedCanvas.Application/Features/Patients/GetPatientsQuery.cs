using MedCanvas.Application.Common.Models;
using MediatR;

namespace MedCanvas.Application.Features.Patients;

public sealed record GetPatientsQuery(
    string? SearchTerm = null,
    int Page = 1,
    int PageSize = 20) : IRequest<PagedResult<PatientDto>>;
