namespace MedCanvas.Domain.Enums;

/// <summary>Lifecycle of a treatment plan (server-enforced transitions; item execution joins in M06).</summary>
public enum TreatmentPlanStatus
{
    Draft = 0,
    Proposed = 1,
    Approved = 2,
    InProgress = 3,
    Completed = 4,
    Cancelled = 5,
}
