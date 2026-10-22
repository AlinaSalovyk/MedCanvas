using MedCanvas.Application.Common.Interfaces;

namespace MedCanvas.Infrastructure.Services;

public sealed class DateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
