using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Patients;

public sealed class GetPatientDuplicatesQueryHandler : IRequestHandler<GetPatientDuplicatesQuery, IReadOnlyList<PatientDto>>
{
    private readonly IMedCanvasDbContext _dbContext;
    private readonly ICurrentUserContext _currentUserContext;

    public GetPatientDuplicatesQueryHandler(IMedCanvasDbContext dbContext, ICurrentUserContext currentUserContext)
    {
        _dbContext = dbContext;
        _currentUserContext = currentUserContext;
    }

    public async Task<IReadOnlyList<PatientDto>> Handle(GetPatientDuplicatesQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.ClinicId == null)
        {
            throw new UnauthorizedAccessException("Authenticated clinic context is required to check duplicates.");
        }

        var clinicId = _currentUserContext.ClinicId.Value;

        var hasMrn = !string.IsNullOrWhiteSpace(request.ExternalMedicalRecordNumber);
        var hasNameDob =
            !string.IsNullOrWhiteSpace(request.FirstName) &&
            !string.IsNullOrWhiteSpace(request.LastName) &&
            request.DateOfBirth.HasValue;

        if (!hasMrn && !hasNameDob)
        {
            return Array.Empty<PatientDto>();
        }

        var mrn = hasMrn ? request.ExternalMedicalRecordNumber!.Trim() : null;
        var firstName = request.FirstName?.Trim();
        var lastName = request.LastName?.Trim();

        var query = _dbContext.Patients.AsNoTracking().Where(p => p.ClinicId == clinicId);

        if (mrn != null && hasNameDob)
        {
            query = query.Where(p =>
                (p.ExternalMedicalRecordNumber != null && p.ExternalMedicalRecordNumber == mrn) ||
                (p.FirstName == firstName && p.LastName == lastName && p.DateOfBirth == request.DateOfBirth));
        }
        else if (mrn != null)
        {
            query = query.Where(p => p.ExternalMedicalRecordNumber != null && p.ExternalMedicalRecordNumber == mrn);
        }
        else
        {
            query = query.Where(p => p.FirstName == firstName && p.LastName == lastName && p.DateOfBirth == request.DateOfBirth);
        }

        var duplicates = await query
            .OrderBy(p => p.LastName)
            .ThenBy(p => p.FirstName)
            .Take(10)
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
                p.ConcurrencyVersion,
                p.CreatedAtUtc,
                p.UpdatedAtUtc))
            .ToListAsync(cancellationToken);

        return duplicates;
    }
}
