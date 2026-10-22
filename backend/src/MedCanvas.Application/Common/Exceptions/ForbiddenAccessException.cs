namespace MedCanvas.Application.Common.Exceptions;

/// <summary>
/// Thrown when an authenticated caller lacks permissions for an operation or attempts cross-clinic access.
/// </summary>
public sealed class ForbiddenAccessException : Exception
{
    public ForbiddenAccessException()
        : base("Access to this resource or operation is forbidden.")
    {
    }

    public ForbiddenAccessException(string message)
        : base(message)
    {
    }
}
