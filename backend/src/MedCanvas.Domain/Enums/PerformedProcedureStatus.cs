namespace MedCanvas.Domain.Enums;

public enum PerformedProcedureStatus
{
    Recorded = 0,
    Voided = 1,
}

/// <summary>Execution state of a treatment plan item (M06 links the two aggregates).</summary>
public enum TreatmentPlanItemStatus
{
    Planned = 0,
    Performed = 1,
}
