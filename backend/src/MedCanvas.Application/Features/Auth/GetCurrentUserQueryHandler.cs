using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace MedCanvas.Application.Features.Auth;

public sealed class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, CurrentUserDto>
{
    private readonly ICurrentUserContext _currentUserContext;
    private readonly IMedCanvasDbContext _dbContext;

    public GetCurrentUserQueryHandler(
        ICurrentUserContext currentUserContext,
        IMedCanvasDbContext dbContext)
    {
        _currentUserContext = currentUserContext;
        _dbContext = dbContext;
    }

    public async Task<CurrentUserDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        if (!_currentUserContext.IsAuthenticated || _currentUserContext.UserId == null)
        {
            throw new UnauthorizedAccessException("Request is not authenticated.");
        }

        var userId = _currentUserContext.UserId.Value;
        var clinicId = _currentUserContext.ClinicId ?? Guid.Empty;

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException(nameof(User), userId);
        }

        return new CurrentUserDto(
            UserId: user.Id,
            Email: user.Email,
            FullName: user.FullName,
            ClinicId: clinicId,
            Role: _currentUserContext.Role ?? string.Empty,
            IsAuthenticated: true);
    }
}
