using MedCanvas.Domain.Common;

namespace MedCanvas.Domain.Entities;

/// <summary>
/// Weekly working-window template for a clinician in clinic-local time
/// (ISO day-of-week 1=Monday … 7=Sunday). Breaks subtract from the window.
/// </summary>
public sealed class ProviderAvailability : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public Guid ClinicianUserId { get; private set; }
    /// <summary>ISO-8601 day of week: 1 (Monday) … 7 (Sunday).</summary>
    public int DayOfWeek { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }

    private ProviderAvailability()
    {
    }

    private ProviderAvailability(Guid id, Guid clinicId, Guid clinicianUserId, int dayOfWeek, TimeOnly startTime, TimeOnly endTime, DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty) throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        if (clinicianUserId == Guid.Empty) throw new ArgumentException("Clinician user ID cannot be empty GUID.", nameof(clinicianUserId));
        if (dayOfWeek is < 1 or > 7) throw new ArgumentException("Day of week must be 1 (Monday) through 7 (Sunday).", nameof(dayOfWeek));
        if (endTime <= startTime) throw new ArgumentException("Availability end must be after its start.", nameof(endTime));

        ClinicId = clinicId;
        ClinicianUserId = clinicianUserId;
        DayOfWeek = dayOfWeek;
        StartTime = startTime;
        EndTime = endTime;
    }

    public static ProviderAvailability Create(Guid clinicId, Guid clinicianUserId, int dayOfWeek, TimeOnly startTime, TimeOnly endTime, DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, clinicianUserId, dayOfWeek, startTime, endTime, utcNow);
}

/// <summary>A break (e.g. lunch) subtracted from a working window.</summary>
public sealed class ProviderAvailabilityBreak : BaseEntity
{
    public Guid ProviderAvailabilityId { get; private set; }
    public TimeOnly StartTime { get; private set; }
    public TimeOnly EndTime { get; private set; }

    private ProviderAvailabilityBreak()
    {
    }

    private ProviderAvailabilityBreak(Guid id, Guid providerAvailabilityId, TimeOnly startTime, TimeOnly endTime, DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (providerAvailabilityId == Guid.Empty) throw new ArgumentException("Availability ID cannot be empty GUID.", nameof(providerAvailabilityId));
        if (endTime <= startTime) throw new ArgumentException("Break end must be after its start.", nameof(endTime));

        ProviderAvailabilityId = providerAvailabilityId;
        StartTime = startTime;
        EndTime = endTime;
    }

    public static ProviderAvailabilityBreak Create(Guid providerAvailabilityId, TimeOnly startTime, TimeOnly endTime, DateTime utcNow) =>
        new(Guid.NewGuid(), providerAvailabilityId, startTime, endTime, utcNow);
}

/// <summary>A dated exception: a day off (IsWorkingDay=false) or an extra working day.</summary>
public sealed class ProviderAvailabilityException : BaseEntity, IAggregateRoot
{
    public Guid ClinicId { get; private set; }
    public Guid ClinicianUserId { get; private set; }
    public DateOnly Date { get; private set; }
    public bool IsWorkingDay { get; private set; }

    private ProviderAvailabilityException()
    {
    }

    private ProviderAvailabilityException(Guid id, Guid clinicId, Guid clinicianUserId, DateOnly date, bool isWorkingDay, DateTime createdAtUtc)
        : base(id, createdAtUtc)
    {
        if (clinicId == Guid.Empty) throw new ArgumentException("Clinic ID cannot be empty GUID.", nameof(clinicId));
        if (clinicianUserId == Guid.Empty) throw new ArgumentException("Clinician user ID cannot be empty GUID.", nameof(clinicianUserId));

        ClinicId = clinicId;
        ClinicianUserId = clinicianUserId;
        Date = date;
        IsWorkingDay = isWorkingDay;
    }

    public static ProviderAvailabilityException Create(Guid clinicId, Guid clinicianUserId, DateOnly date, bool isWorkingDay, DateTime utcNow) =>
        new(Guid.NewGuid(), clinicId, clinicianUserId, date, isWorkingDay, utcNow);
}
