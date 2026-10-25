using System.Net.Http.Headers;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Domain.Entities;
using MedCanvas.Domain.Enums;
using MedCanvas.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace MedCanvas.Api.IntegrationTests.Infrastructure;

public class MedCanvasApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _dbContainer = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("medcanvas_api_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public MedCanvasApiFactory()
    {
        Environment.SetEnvironmentVariable("Jwt__Secret", TestJwtGenerator.DefaultTestSecret);
        Environment.SetEnvironmentVariable("Jwt__Issuer", TestJwtGenerator.DefaultIssuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", TestJwtGenerator.DefaultAudience);
        Environment.SetEnvironmentVariable("Jwt__ExpiryMinutes", "240");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.UseSetting("Jwt:Secret", TestJwtGenerator.DefaultTestSecret);
        builder.UseSetting("Jwt:Issuer", TestJwtGenerator.DefaultIssuer);
        builder.UseSetting("Jwt:Audience", TestJwtGenerator.DefaultAudience);
        builder.UseSetting("Jwt:ExpiryMinutes", "240");

        // Integration tests fire many auth requests from one address; the dedicated
        // rate-limit test overrides this locally to exercise the 429 path.
        builder.UseSetting("RateLimiting:Auth:PermitLimit", "10000");

        builder.ConfigureTestServices(services =>
        {
            var dbContextDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<MedCanvasDbContext>));
            if (dbContextDescriptor != null)
            {
                services.Remove(dbContextDescriptor);
            }

            var ifaceDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(IMedCanvasDbContext));
            if (ifaceDescriptor != null)
            {
                services.Remove(ifaceDescriptor);
            }

            var dataSourceBuilder = new NpgsqlDataSourceBuilder(_dbContainer.GetConnectionString());
            dataSourceBuilder.EnableDynamicJson();
            var dataSource = dataSourceBuilder.Build();

            services.AddDbContext<MedCanvasDbContext>(options =>
            {
                options.UseNpgsql(dataSource, npgsqlOptions =>
                {
                    npgsqlOptions.MigrationsAssembly(typeof(MedCanvasDbContext).Assembly.FullName);
                });
                options.ConfigureWarnings(w => w.Ignore(CoreEventId.ManyServiceProvidersCreatedWarning));
            });

            services.AddScoped<IMedCanvasDbContext>(sp => sp.GetRequiredService<MedCanvasDbContext>());
        });
    }

    public async Task InitializeAsync()
    {
        await _dbContainer.StartAsync();

        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MedCanvasDbContext>();
        await context.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await _dbContainer.DisposeAsync();
    }

    public async Task ResetDatabaseAsync()
    {
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<MedCanvasDbContext>();

        context.ClinicalAuditEvents.RemoveRange(context.ClinicalAuditEvents);
        context.OdontogramRevisions.RemoveRange(context.OdontogramRevisions);
        context.OdontogramRecords.RemoveRange(context.OdontogramRecords);
        context.DentalEncounters.RemoveRange(context.DentalEncounters);
        context.Patients.RemoveRange(context.Patients);
        context.ClinicMemberships.RemoveRange(context.ClinicMemberships);
        context.Users.RemoveRange(context.Users);
        context.Clinics.RemoveRange(context.Clinics);

        await context.SaveChangesAsync();
    }

    public HttpClient CreateAnonymousClient()
    {
        return CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });
    }

    public HttpClient CreateAuthenticatedClient(User user, Guid clinicId, MembershipRole role)
    {
        using var scope = Services.CreateScope();
        var jwtService = scope.ServiceProvider.GetRequiredService<IJwtTokenService>();
        var token = jwtService.GenerateToken(user, clinicId, role, DateTime.UtcNow.AddHours(4));

        var client = CreateAnonymousClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
