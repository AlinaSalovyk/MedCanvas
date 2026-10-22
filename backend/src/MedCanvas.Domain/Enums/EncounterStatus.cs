namespace MedCanvas.Domain.Enums;

/// <summary>
/// State machine values for a clinical dental encounter.
/// </summary>
public enum EncounterStatus
{
    Planned = 1,
    InProgress = 2,
    Completed = 3,
    Cancelled = 4
}
