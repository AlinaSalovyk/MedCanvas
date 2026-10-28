namespace MedCanvas.Application.Common.Security;

/// <summary>
/// Centralized authorization policy names for MedCanvas clinical operations.
/// </summary>
public static class Policies
{
    public const string CanReadPatients = "CanReadPatients";
    public const string CanMutatePatients = "CanMutatePatients";
    public const string CanReadEncounters = "CanReadEncounters";
    public const string CanMutateEncounters = "CanMutateEncounters";
    public const string CanReadOdontogram = "CanReadOdontogram";
    public const string CanMutateOdontogram = "CanMutateOdontogram";
    public const string CanFinalizeOdontogram = "CanFinalizeOdontogram";
    public const string CanExportFhir = "CanExportFhir";
    public const string CanReadClinicProfile = "CanReadClinicProfile";
    public const string CanManageClinic = "CanManageClinic";
    public const string CanReadCalendar = "CanReadCalendar";
    public const string CanManageCalendar = "CanManageCalendar";
    public const string CanRegisterSimulatedPayments = "CanRegisterSimulatedPayments";
}
