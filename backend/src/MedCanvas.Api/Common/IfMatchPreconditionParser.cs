using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MedCanvas.Api.Common;

/// <summary>
/// RFC 7232 compliant parser for If-Match concurrency precondition headers.
/// Enforces strong entity tags with positive integer revision tokens for clinical record mutations.
/// </summary>
public static class IfMatchPreconditionParser
{
    public static (bool IsValid, int? Version, ProblemDetails? Problem) ParseIfMatchHeader(
        IHeaderDictionary headers,
        string requestPath,
        int? bodyExpectedVersion = null)
    {
        if (!headers.TryGetValue("If-Match", out var ifMatchValues) || ifMatchValues.Count == 0)
        {
            return (true, bodyExpectedVersion, null);
        }

        if (ifMatchValues.Count > 1)
        {
            return (false, null, CreateProblem(
                "https://medcanvas.health/errors/malformed-etag",
                "Malformed Precondition",
                StatusCodes.Status400BadRequest,
                "Multiple If-Match header lines are not permitted for clinical state mutations.",
                requestPath));
        }

        var rawHeader = ifMatchValues.ToString();
        if (string.IsNullOrWhiteSpace(rawHeader))
        {
            return (true, bodyExpectedVersion, null);
        }

        var trimmed = rawHeader.Trim();

        // Check for comma-separated multiple ETags
        if (trimmed.Contains(','))
        {
            return (false, null, CreateProblem(
                "https://medcanvas.health/errors/malformed-etag",
                "Malformed Precondition",
                StatusCodes.Status400BadRequest,
                "Multiple ETags in If-Match header are not permitted for clinical state mutations.",
                requestPath));
        }

        if (trimmed == "*")
        {
            return (false, null, CreateProblem(
                "https://medcanvas.health/errors/malformed-etag",
                "Malformed Precondition",
                StatusCodes.Status400BadRequest,
                "Wildcard '*' in If-Match header is not permitted for clinical state mutations.",
                requestPath));
        }

        if (!EntityTagHeaderValue.TryParse(trimmed, out var etag))
        {
            return (false, null, CreateProblem(
                "https://medcanvas.health/errors/malformed-etag",
                "Malformed Precondition",
                StatusCodes.Status400BadRequest,
                "The provided If-Match header value is not a valid quoted entity-tag.",
                requestPath));
        }

        if (etag.IsWeak)
        {
            return (false, null, CreateProblem(
                "https://medcanvas.health/errors/malformed-etag",
                "Malformed Precondition",
                StatusCodes.Status400BadRequest,
                "Weak ETags are not permitted in If-Match preconditions for clinical state mutations.",
                requestPath));
        }

        var tagContent = etag.Tag.Trim('\"');
        if (!int.TryParse(tagContent, out var parsedVersion) || parsedVersion < 1)
        {
            return (false, null, CreateProblem(
                "https://medcanvas.health/errors/malformed-etag",
                "Malformed Precondition",
                StatusCodes.Status400BadRequest,
                "The entity-tag value is not a valid positive integer revision token.",
                requestPath));
        }

        if (bodyExpectedVersion.HasValue && bodyExpectedVersion.Value != parsedVersion)
        {
            return (false, null, CreateProblem(
                "https://medcanvas.health/errors/precondition-mismatch",
                "Precondition Mismatch",
                StatusCodes.Status400BadRequest,
                "The version specified in the If-Match header contradicts the expectedVersion in the request payload.",
                requestPath));
        }

        return (true, parsedVersion, null);
    }

    private static ProblemDetails CreateProblem(string type, string title, int status, string detail, string instance)
    {
        return new ProblemDetails
        {
            Type = type,
            Title = title,
            Status = status,
            Detail = detail,
            Instance = instance
        };
    }
}
