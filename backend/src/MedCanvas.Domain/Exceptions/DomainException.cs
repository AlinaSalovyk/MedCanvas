namespace MedCanvas.Domain.Exceptions;

/// <summary>
/// Base exception for all business domain invariant violations in MedCanvas.
/// </summary>
public class DomainException : Exception
{
    public DomainException(string message) : base(message)
    {
    }

    public DomainException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
