using MedCanvas.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Core infrastructure services (PostgreSQL, Repositories, DbContext)
builder.Services.AddInfrastructureServices(builder.Configuration);

// Add controllers
builder.Services.AddControllers();

// OpenAPI
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();

// Required for WebApplicationFactory<Program> in integration test suites
public partial class Program { }
