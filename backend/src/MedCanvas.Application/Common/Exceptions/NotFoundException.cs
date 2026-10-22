namespace MedCanvas.Application.Common.Exceptions;

/// <summary>
/// Thrown when a requested resource is not found or does not belong to the caller's clinic tenant.
/// </summary>
public sealed class NotFoundException : Exception
{
    public string ResourceName { get; }
    public object ResourceKey { get; }

    public NotFoundException(string resourceName, object resourceKey)
        : base($"Resource '{resourceName}' with key '{resourceKey}' was not found.")
    {
        ResourceName = resourceName;
        ResourceKey = resourceKey;
    }
}
