using System.Diagnostics;
using System.Text.Json;
using FluentValidation;
using MedCanvas.Application.Common.Exceptions;
using MedCanvas.Domain.Exceptions;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var traceId = Activity.Current?.Id ?? context.TraceIdentifier;

        var (statusCode, problemDetails) = exception switch
        {
            ValidationException validationEx => (
                StatusCodes.Status400BadRequest,
                new ValidationProblemDetails(
                    validationEx.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()))
                {
                    Type = "https://medcanvas.health/errors/validation-failed",
                    Title = "Validation Failed",
                    Status = StatusCodes.Status400BadRequest,
                    Detail = "One or more validation errors occurred.",
                    Instance = context.Request.Path
                }),

            UnauthorizedAccessException unauthEx => (
                StatusCodes.Status401Unauthorized,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/unauthorized",
                    Title = "Unauthorized",
                    Status = StatusCodes.Status401Unauthorized,
                    Detail = unauthEx.Message,
                    Instance = context.Request.Path
                }),

            NotFoundException notFoundEx => (
                StatusCodes.Status404NotFound,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/not-found",
                    Title = "Resource Not Found",
                    Status = StatusCodes.Status404NotFound,
                    Detail = notFoundEx.Message,
                    Instance = context.Request.Path
                }),

            ForbiddenAccessException forbiddenEx => (
                StatusCodes.Status403Forbidden,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/forbidden",
                    Title = "Forbidden",
                    Status = StatusCodes.Status403Forbidden,
                    Detail = forbiddenEx.Message,
                    Instance = context.Request.Path
                }),

            PreconditionRequiredException reqEx => (
                StatusCodes.Status428PreconditionRequired,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/precondition-required",
                    Title = "Precondition Required",
                    Status = StatusCodes.Status428PreconditionRequired,
                    Detail = reqEx.Message,
                    Instance = context.Request.Path
                }),

            ConcurrencyConflictException concurrencyEx => (
                StatusCodes.Status412PreconditionFailed,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/concurrency-conflict",
                    Title = "Precondition Failed (Concurrency Conflict)",
                    Status = StatusCodes.Status412PreconditionFailed,
                    Detail = concurrencyEx.Message,
                    Instance = context.Request.Path
                }),

            Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException => (
                StatusCodes.Status412PreconditionFailed,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/concurrency-conflict",
                    Title = "Precondition Failed (Database Concurrency Conflict)",
                    Status = StatusCodes.Status412PreconditionFailed,
                    Detail = "The clinical record has been modified by another concurrent transaction.",
                    Instance = context.Request.Path
                }),

            RecordFinalizedException finalizedEx => (
                StatusCodes.Status422UnprocessableEntity,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/record-finalized",
                    Title = "Record Finalized and Immutable",
                    Status = StatusCodes.Status422UnprocessableEntity,
                    Detail = finalizedEx.Message,
                    Instance = context.Request.Path
                }),

            DomainException domainEx => (
                StatusCodes.Status400BadRequest,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/domain-rule-violation",
                    Title = "Domain Rule Violation",
                    Status = StatusCodes.Status400BadRequest,
                    Detail = domainEx.Message,
                    Instance = context.Request.Path
                }),

            _ => (
                StatusCodes.Status500InternalServerError,
                new ProblemDetails
                {
                    Type = "https://medcanvas.health/errors/internal-server-error",
                    Title = "An error occurred while processing your request.",
                    Status = StatusCodes.Status500InternalServerError,
                    Detail = "A server error occurred. Please contact system support with the provided trace ID.",
                    Instance = context.Request.Path
                })
        };

        problemDetails.Extensions["traceId"] = traceId;

        var safeLogMessage = SanitizeForLogging(exception.Message);

        if (statusCode >= StatusCodes.Status500InternalServerError)
        {
            _logger.LogError("Unhandled server exception ({ExceptionType}). TraceId: {TraceId}", exception.GetType().Name, traceId);
        }
        else
        {
            _logger.LogWarning("Handled request exception ({StatusCode}): {Message}. TraceId: {TraceId}",
                statusCode, safeLogMessage, traceId);
        }

        context.Response.ContentType = "application/problem+json";
        context.Response.StatusCode = statusCode;

        var json = JsonSerializer.Serialize(problemDetails, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        });

        await context.Response.WriteAsync(json);
    }

    private static string SanitizeForLogging(string message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return string.Empty;
        }

        // Redact JSON structures
        if (message.Contains('{') && message.Contains('}'))
        {
            message = System.Text.RegularExpressions.Regex.Replace(message, @"\{.*?\}", "[REDACTED_PAYLOAD]");
        }

        // Redact JWT or Bearer tokens if present
        message = System.Text.RegularExpressions.Regex.Replace(message, @"(ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})", "[REDACTED_JWT]");

        return message;
    }
}
