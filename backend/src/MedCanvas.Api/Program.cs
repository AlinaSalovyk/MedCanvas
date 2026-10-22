using System.Text;
using MedCanvas.Api.Middleware;
using MedCanvas.Application;
using MedCanvas.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Application layer services (MediatR, FluentValidation, Pipeline behaviors)
builder.Services.AddApplicationServices();

// Infrastructure layer services (PostgreSQL, Repositories, DbContext, Auth services)
builder.Services.AddInfrastructureServices(builder.Configuration);

// JWT Authentication setup
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "MedCanvasDevelopmentSecretKeyMustBeAtLeast32BytesLongForHmacSha256Security12345";
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

builder.Services.AddAuthorization();

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
