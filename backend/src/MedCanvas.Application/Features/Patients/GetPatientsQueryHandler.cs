using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Application.Common.Models;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Patients;

public sealed class GetPatientsQueryHandler : IRequestHandler<GetPatientsQuery, PagedResult<PatientDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPatientsQueryHandler(
        IMedCanvasDbContext dbContext,
        ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<PagedResult<PatientDto>> Handle(GetPatientsQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to query patients.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var query = _dbContext.Patients
            .AsNoTracking()
            .Where(p => p.ClinicId == clinicId && p.IsActive);

        if (!string.IsNullOrWhiteSpace(request.SearchTerm))
        {
            var term = request.SearchTerm.Trim().ToLower();
            query = query.Where(p =>
                p.FirstName.ToLower().Contains(term) ||
                p.LastName.ToLower().Contains(term) ||
                (p.ExternalMedicalRecordNumber != null && p.ExternalMedicalRecordNumber.ToLower().Contains(term)) ||
                (p.Phone != null && p.Phone.Contains(term)) ||
                (p.Email != null && p.Email.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 20 : (request.PageSize > 100 ? 100 : request.PageSize);

        var items = await query
            .OrderBy(p => p.LastName)
            .ThenBy(p => p.FirstName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PatientDto(
                p.Id,
                p.ClinicId,
                p.FirstName,
                p.LastName,
                p.FullName,
                p.DateOfBirth,
                p.Gender,
                p.Phone,
                p.Email,
                p.ExternalMedicalRecordNumber,
                p.MedicalAlerts,
                p.IsActive,
                p.CreatedAtUtc,
                p.UpdatedAtUtc))
            .ToListAsync(cancellationToken);

        return new PagedResult<PatientDto>(items, totalCount, page, pageSize);
    }
}
