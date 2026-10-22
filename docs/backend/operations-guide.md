# MedCanvas Backend Operations & Deployment Guide

## 1. Overview & Technology Stack

MedCanvas Backend is an ASP.NET Core 10 Web API built using Clean Architecture, PostgreSQL with native `jsonb` document storage, EF Core, MediatR, and FluentValidation.

- **Target Framework**: .NET 10 LTS (`net10.0`)
- **Database**: PostgreSQL 16+ (Docker pinned `postgres:16-alpine`)
- **JSON Serialization**: `System.Text.Json` with lossless UTF-8 round-trip fidelity
- **Integration Testing**: Testcontainers for .NET with pinned `postgres:16-alpine`

---

## 2. Local Development Setup

### Prerequisites
- .NET 10 SDK (`dotnet --version` showing 10.0.x)
- Docker Desktop or Docker Engine running (for Testcontainers during integration tests)
- Node.js 20+ (for frontend client and tests)

### Restoring and Building
```powershell
# Restore dependencies
dotnet restore backend/MedCanvas.sln

# Build Release
dotnet build backend/MedCanvas.sln --configuration Release
```

### Running the Web API Locally
```powershell
# Run the API with Development profile
dotnet run --project backend/src/MedCanvas.Api/MedCanvas.Api.csproj
```
The API listens on `http://localhost:5000` (or configured HTTPS port). Swagger UI is available at `http://localhost:5000/swagger`.

### Environment Configuration (`appsettings.json` / Environment Variables)
| Variable | Description | Default (Development) |
|---|---|---|
| `ConnectionStrings:DefaultConnection` | PostgreSQL connection string | `Host=localhost;Port=5432;Database=medcanvas;Username=postgres;Password=postgres` |
| `Jwt:Secret` | 256-bit secret key for HMAC-SHA256 signing | `ThisIsASecretKeyForTestingJwtTokenGenerationWithMinimum256BitsLength!` |
| `Jwt:Issuer` | JWT issuer identifier | `MedCanvasServer` |
| `Jwt:Audience` | JWT audience identifier | `MedCanvasClients` |
| `Cors:AllowedOrigins:0` | Permitted frontend origin | `http://localhost:5173` |

---

## 3. Database Migrations

### EF Core CLI Commands
Ensure `dotnet-ef` global tool is installed:
```powershell
dotnet tool install --global dotnet-ef
```

Applying migrations to a local database:
```powershell
dotnet ef database update --project backend/src/MedCanvas.Infrastructure/MedCanvas.Infrastructure.csproj --startup-project backend/src/MedCanvas.Api/MedCanvas.Api.csproj
```

Adding a new migration:
```powershell
dotnet ef migrations add <MigrationName> --project backend/src/MedCanvas.Infrastructure/MedCanvas.Infrastructure.csproj --startup-project backend/src/MedCanvas.Api/MedCanvas.Api.csproj
```

Generating an idempotent SQL script for production release:
```powershell
dotnet ef migrations script --idempotent --project backend/src/MedCanvas.Infrastructure/MedCanvas.Infrastructure.csproj --startup-project backend/src/MedCanvas.Api/MedCanvas.Api.csproj --output migrate.sql
```

---

## 4. Testing Execution

### Running the Complete Backend Suite
```powershell
# Full suite with coverage
dotnet test backend/MedCanvas.sln --configuration Release --collect:"XPlat Code Coverage"
```

### Project-Specific Test Commands
```powershell
# Domain unit tests (108 tests - 95.46% line coverage)
dotnet test backend/tests/MedCanvas.Domain.Tests/MedCanvas.Domain.Tests.csproj

# Application pipeline and validator tests (35 tests)
dotnet test backend/tests/MedCanvas.Application.Tests/MedCanvas.Application.Tests.csproj

# Infrastructure & database tests (17 tests with Testcontainers)
dotnet test backend/tests/MedCanvas.Infrastructure.IntegrationTests/MedCanvas.Infrastructure.IntegrationTests.csproj

# End-to-end API integration tests (26 tests with Testcontainers)
dotnet test backend/tests/MedCanvas.Api.IntegrationTests/MedCanvas.Api.IntegrationTests.csproj
```

### Code Formatting Verification
```powershell
dotnet format backend/MedCanvas.sln --verify-no-changes
```

---

## 5. Security & Operational Rules

1. **Zero Secret Storage in Source**: Production secrets (`Jwt:Secret`, database credentials) must be injected via environment variables or secret vaults (e.g. Azure Key Vault, AWS Secrets Manager).
2. **Multi-Tenant Clinic Scoping**: Every patient record, encounter, and odontogram snapshot is scoped by `ClinicId`. Cross-clinic IDOR requests return 404 Not Found to prevent clinic discovery.
3. **Optimistic Locking via ETag**: All update and finalization requests on odontograms require the `If-Match` header. Concurrent writes from different sessions yield HTTP 412 Precondition Failed.
4. **Finalized Immutability**: Once an encounter or odontogram is finalized, no further edits are accepted; attempts result in HTTP 422 Unprocessable Entity.
5. **No PHI in Standard Logs**: The logging behavior redacts clinical snapshot JSON payloads and patient identifiable fields from console output.

---

## 6. Known Limitations & Future Extensibility

- **FHIR Export Scope**: The current FHIR R4 export extracts Patient, Organization, Encounter, and Caries Conditions from the odontogram snapshot. Periodontal deep pocket conditions (PD >= 4mm) and restoration history can be added in future iterations.
- **Single-Node Testcontainers**: Tests run against single-node PostgreSQL containers; production deployments should use high-availability replicas with managed failover.
- **Offline Sync Resolution**: In the current frontend sync bridge, a 412 conflict notifies the user and retrieves the server copy; interactive visual three-way merge is a candidate for subsequent frontend UI enhancements.
