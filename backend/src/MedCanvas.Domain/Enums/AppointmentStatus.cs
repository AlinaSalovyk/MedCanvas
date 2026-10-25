namespace MedCanvas.Domain.Enums;

/// <summary>Lifecycle states of a calendar appointment (server-enforced transitions).</summary>
public enum AppointmentStatus
{
    Scheduled = 0,
    Confirmed = 1,
    Arrived = 2,
    InProgress = 3,
    Completed = 4,
    Cancelled = 5,
    NoShow = 6,
}
