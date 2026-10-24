using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Infrastructure.Persistence;
using MedCanvas.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MedCanvas.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=medcanvas_dev;Username=postgres;Password=postgres";

        services.AddDbContext<MedCanvasDbContext>((sp, options) =>
        {
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.MigrationsAssembly(typeof(MedCanvasDbContext).Assembly.FullName);
            });
        });

        services.AddScoped<IMedCanvasDbContext>(provider => provider.GetRequiredService<MedCanvasDbContext>());
        services.AddScoped<IOdontogramRepository, OdontogramRepository>();
        services.AddScoped<IPatientRepository, PatientRepository>();
        services.AddScoped<IEncounterRepository, EncounterRepository>();

        services.AddHttpContextAccessor();
        services.AddSingleton<IDateTimeProvider, Services.DateTimeProvider>();
        services.AddSingleton<IPasswordHasher, Services.PasswordHasher>();
        services.AddScoped<IJwtTokenService, Services.JwtTokenService>();
        services.AddScoped<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, Security.ActiveClinicMembershipHandler>();

        return services;
    }
}
