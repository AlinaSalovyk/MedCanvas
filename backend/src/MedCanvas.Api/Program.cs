using System.Text;
using MedCanvas.Api.Middleware;
using MedCanvas.Api.Services;
using MedCanvas.Application;
using MedCanvas.Application.Common.Interfaces;
using MedCanvas.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

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
    if (builder.Environment.IsDevelopment())
    {
        jwtSecret = "MedCanvasDevelopmentSecretKeyMustBeAtLeast32BytesLongForHmacSha256Security12345";
    }
    else
    {
        throw new InvalidOperationException("Fatal security error: 'Jwt:Secret' configuration is missing or shorter than 256 bits (32 bytes). Non-development environments cannot start without an explicitly configured secure key.");
    }
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

var app = builder.Build();

// Centralized ProblemDetails exception handling
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseCors("MedCanvasCorsPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Required for WebApplicationFactory<Program> in integration tests
public partial class Program { }
