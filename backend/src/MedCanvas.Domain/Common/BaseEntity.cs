namespace MedCanvas.Domain.Common;

/// <summary>
/// Abstract base class for all domain entities providing identity and audit timestamps.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; protected set; }
    public DateTime CreatedAtUtc { get; protected set; }
    public DateTime UpdatedAtUtc { get; protected set; }

    protected BaseEntity()
    {
    }

    protected BaseEntity(Guid id, DateTime createdAtUtc)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException("Entity ID cannot be empty GUID.", nameof(id));
        }

        Id = id;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = createdAtUtc;
    }

    public void SetUpdatedTimestamp(DateTime updatedAtUtc)
    {
        if (updatedAtUtc < CreatedAtUtc)
        {
            throw new ArgumentException("Updated timestamp cannot precede creation timestamp.", nameof(updatedAtUtc));
        }

        UpdatedAtUtc = updatedAtUtc;
    }
}
