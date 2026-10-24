namespace MedCanvas.Application.Common.Exceptions;

/// <summary>
/// Thrown when a clinical state update request is missing the required If-Match concurrency precondition.
/// </summary>
public sealed class PreconditionRequiredException : Exception
{
    public PreconditionRequiredException(string message) : base(message)
    {
    }
}
