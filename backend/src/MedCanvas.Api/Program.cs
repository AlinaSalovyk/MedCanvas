using System.Text;
using System.Threading.RateLimiting;
using MedCanvas.Api.Middleware;
using MedCanvas.Api.Services;
using MedCanvas.Application;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Database connection configuration validation
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (!builder.Environment.IsDevelopment() && !builder.Environment.EnvironmentName.Equals("Testing", StringComparison.OrdinalIgnoreCase))
{
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        throw new InvalidOperationException("Fatal configuration error: 'ConnectionStrings:DefaultConnection' is missing in non-development environment. A secure connection string must be configured via environment variables or secret provider.");
    }

    if (connectionString.Contains("Password=postgres", StringComparison.OrdinalIgnoreCase) ||
        connectionString.Contains("Username=postgres", StringComparison.OrdinalIgnoreCase))
    {
        throw new InvalidOperationException("Fatal security error: 'ConnectionStrings:DefaultConnection' contains default development credentials (Username=postgres/Password=postgres) in a non-development environment. Secure credentials are required.");
    }
}

// Application layer services (MediatR, FluentValidation, Pipeline behaviors)
builder.Services.AddApplicationServices();

// Infrastructure layer services (PostgreSQL, Repositories, DbContext, Auth services)
builder.Services.AddInfrastructureServices(builder.Configuration);

// User context from HttpContext claims
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();

// JWT Authentication setup
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtSecret) || Encoding.UTF8.GetByteCount(jwtSecret) < 32)
{
    throw new InvalidOperationException("Fatal security error: 'Jwt:Secret' configuration is missing or shorter than 256 bits (32 bytes). All environments (including Development) require an explicitly configured secure signing key (via User Secrets or environment variable).");
}

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "MedCanvas.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "MedCanvas.Client";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanRegisterSimulatedPayments, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Assistant)));
    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanReadPatients, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant,
            MedCanvas.Domain.Enums.MembershipRole.Viewer)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanMutatePatients, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanReadEncounters, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant,
            MedCanvas.Domain.Enums.MembershipRole.Viewer)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanMutateEncounters, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanReadOdontogram, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant,
            MedCanvas.Domain.Enums.MembershipRole.Viewer)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanMutateOdontogram, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanFinalizeOdontogram, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanExportFhir, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanReadClinicProfile, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant,
            MedCanvas.Domain.Enums.MembershipRole.Viewer)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanManageClinic, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanReadCalendar, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant,
            MedCanvas.Domain.Enums.MembershipRole.Viewer)));

    options.AddPolicy(MedCanvas.Application.Common.Security.Policies.CanManageCalendar, policy =>
        policy.Requirements.Add(new MedCanvas.Infrastructure.Security.ActiveClinicMembershipRequirement(
            MedCanvas.Domain.Enums.MembershipRole.ClinicAdmin,
            MedCanvas.Domain.Enums.MembershipRole.Clinician,
            MedCanvas.Domain.Enums.MembershipRole.Assistant)));
});

// CORS policy
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173", "http://localhost:3000"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("MedCanvasCorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .WithExposedHeaders("ETag");
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Rate limiting: credential-stuffing protection on unauthenticated auth surfaces.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.OnRejected = async (context, cancellationToken) =>
    {
        var response = context.HttpContext.Response;
        response.ContentType = "application/problem+json";

        await response.WriteAsync(
            """{"type":"https://medcanvas.health/errors/rate-limited","title":"Too many requests","status":429,"detail":"Too many requests. Please try again later."}""",
            cancellationToken);
    };

    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = builder.Configuration.GetValue("RateLimiting:Auth:PermitLimit", 10),
                Window = TimeSpan.FromSeconds(builder.Configuration.GetValue("RateLimiting:Auth:WindowSeconds", 60)),
                QueueLimit = 0
            }));
});

var app = builder.Build();

// Centralized ProblemDetails exception handling
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

if (!app.Environment.IsDevelopment() && !app.Environment.EnvironmentName.Equals("Testing", StringComparison.OrdinalIgnoreCase))
{
    app.UseHsts();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("MedCanvasCorsPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.Run();

// Required for WebApplicationFactory<Program> in integration tests
public partial class Program { }
