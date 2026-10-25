using MediatR;

namespace MedCanvas.Application.Features.Scheduling;

public sealed record GetAvailabilityQuery(Guid ClinicianUserId) : IRequest<AvailabilityTemplateDto>;

public sealed record AvailabilityWindowInput(int DayOfWeek, TimeOnly StartTime, TimeOnly EndTime, IReadOnlyList<AvailabilityBreakInput> Breaks);

public sealed record AvailabilityBreakInput(TimeOnly StartTime, TimeOnly EndTime);

/// <summary>Replace a clinician's entire weekly availability template (idempotent full replace).</summary>
public sealed record ReplaceAvailabilityCommand(
    Guid ClinicianUserId,
    IReadOnlyList<AvailabilityWindowInput> Windows) : IRequest<AvailabilityTemplateDto>;

public sealed record AddAvailabilityExceptionCommand(Guid ClinicianUserId, DateOnly Date, bool IsWorkingDay)
    : IRequest<AvailabilityTemplateDto>;

public sealed record RemoveAvailabilityExceptionCommand(Guid ExceptionId) : IRequest;
