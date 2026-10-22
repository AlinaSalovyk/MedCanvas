using System.Diagnostics;
using MedCanvas.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace MedCanvas.Application.Common.Behaviors;

/// <summary>
/// Pipeline behavior for performance telemetry and operational logging without PHI leakage.
/// </summary>
public sealed class LoggingBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;
    private readonly ICurrentUserContext _userContext;

    public LoggingBehavior(
        ILogger<LoggingBehavior<TRequest, TResponse>> logger,
        ICurrentUserContext userContext)
    {
        _logger = logger;
        _userContext = userContext;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        var userId = _userContext.UserId?.ToString() ?? "Anonymous";
        var clinicId = _userContext.ClinicId?.ToString() ?? "None";

        _logger.LogInformation(
            "MedCanvas Request: Starting {RequestName} for User {UserId} in Clinic {ClinicId}",
            requestName, userId, clinicId);

        var stopwatch = Stopwatch.StartNew();
        var response = await next();
        stopwatch.Stop();

        _logger.LogInformation(
            "MedCanvas Request: Completed {RequestName} in {ElapsedMs}ms",
            requestName, stopwatch.ElapsedMilliseconds);

        return response;
    }
}
