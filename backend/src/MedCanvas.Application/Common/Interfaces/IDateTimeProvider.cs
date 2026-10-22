namespace MedCanvas.Application.Common.Interfaces;

/// <summary>
/// Abstraction for system clock enabling deterministic testing of UTC timestamps.
/// </summary>
public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
}
