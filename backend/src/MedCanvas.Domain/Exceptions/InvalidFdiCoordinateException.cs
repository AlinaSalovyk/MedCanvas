namespace MedCanvas.Domain.Exceptions;

/// <summary>
/// Thrown when an invalid tooth identifier is provided that is not one of the 32 permanent ISO 3950 FDI coordinates.
/// </summary>
public sealed class InvalidFdiCoordinateException : DomainException
{
    public string ToothKey { get; }

    public InvalidFdiCoordinateException(string toothKey)
        : base($"Invalid FDI tooth coordinate '{toothKey}'. MedCanvas strictly supports permanent ISO 3950 tooth coordinates (18-11, 21-28, 31-38, 48-41). Deciduous teeth must be charted as findings on the permanent coordinates.")
    {
        ToothKey = toothKey;
    }
}
