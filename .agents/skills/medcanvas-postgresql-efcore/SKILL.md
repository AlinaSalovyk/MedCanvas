---
name: medcanvas-postgresql-efcore
description: Design, configure, migrate, and test PostgreSQL persistence with EF Core, Npgsql, JSONB clinical documents, indexes, and Testcontainers.
---

# MedCanvas PostgreSQL & EF Core Skill

## 1. When to Activate This Skill
Activate this skill whenever:
- Designing or modifying database tables, columns, indexes, foreign keys, or constraints in PostgreSQL.
- Configuring EF Core entities via `IEntityTypeConfiguration<T>`.
- Persisting JSONB clinical documents or complex JSON structures.
- Creating or applying EF Core database migrations.
- Implementing repositories or read-only query services with `Npgsql`.
- Running integration tests against real PostgreSQL using Testcontainers.

---

## 2. Rules Derived from Reference Architecture
From the verified reference audit (`docs/backend/reference-audit.md`):
1. **Dedicated Configuration Classes:**
   - Every entity has a separate configuration class implementing `IEntityTypeConfiguration<T>` in `Infrastructure/Persistence/Configurations/`.
   - Table names and column names use clean PostgreSQL `snake_case` (`builder.ToTable("odontogram_records");`).
2. **Global UTC Date Conversion:**
   - Use a value converter (`DateTimeUtcConverter`) in `ConfigureConventions` to ensure all `DateTime` values are strictly UTC upon write and read.
3. **No Tracking for Read Queries:**
   - Query services must systematically apply `.AsNoTracking()` to avoid EF Core change tracking overhead on read models.
4. **CQS Segregation:**
   - Keep write operations in Repositories calling `SaveChangesAsync`.
   - Keep read operations in Query services returning read models or projected DTOs.

---

## 3. MedCanvas-Specific Adaptations
1. **Pinned Testcontainers Image:**
   - Never use `postgres:latest`. Use a pinned version:
     `new PostgreSqlBuilder().WithImage("postgres:16-alpine")`.
2. **Explicit Relational Foreign Keys:**
   - Unlike the reference (which omitted FK constraints), MedCanvas must explicitly configure foreign keys:
     ```csharp
     builder.HasOne<Patient>()
            .WithMany()
            .HasForeignKey(x => x.PatientId)
            .OnDelete(DeleteBehavior.Restrict);
     ```
3. **JSONB Canonical Payload Storage:**
   - Canonical odontogram states are stored as PostgreSQL `jsonb`:
     ```csharp
     builder.Property(x => x.ClinicalData)
            .HasColumnType("jsonb")
            .IsRequired();
     ```
   - Enables native JSON indexing, GIN indexing if needed, and lossless preservation of frontend SVG data.
4. **Optimistic Concurrency:**
   - Implement concurrency control using PostgreSQL's native `xmin` system column or an explicit `Version` integer:
     ```csharp
     builder.Property(x => x.Version)
            .IsConcurrencyToken();
     ```
5. **Clean Migration History:**
   - Never commit empty migrations. Inspect generated migration files before committing to ensure they contain actual schema modifications.

---

## 4. Approved Patterns
- **Entity Configurations via Assembly Scanning:** `modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly)`.
- **Compound & Filtered Indexes:** Indexing multi-tenant keys (e.g. `ix_patients_clinic_id_record_number` unique).
- **Testcontainers Integration:** Spinning up lightweight, disposable PostgreSQL containers per test suite.

---

## 5. Anti-Patterns (Forbidden)
- ❌ Committing empty or redundant migrations.
- ❌ Running automatic `Database.MigrateAsync()` on production web API startup.
- ❌ Hardcoding database credentials in `appsettings.json`.
- ❌ Missing foreign key constraints on relational tables.
- ❌ Using in-memory EF Core provider for integration tests (it does not support PostgreSQL JSONB, sequences, or constraints).

---

## 6. Implementation Procedure
1. Create entity configuration in `Infrastructure/Persistence/Configurations/<Entity>Configuration.cs`.
2. Map table, columns, keys, foreign keys, indexes, and JSONB columns.
3. Register `DbSet<Entity>` on `IApplicationDbContext` and `ApplicationDbContext`.
4. Generate migration using `dotnet ef migrations add <DescriptiveName> --project src/MedCanvas.Infrastructure --startup-project src/MedCanvas.Api`.
5. Review the generated `.cs` file to ensure valid SQL generation and non-empty `Up`/`Down`.
6. Implement repository and query services.
7. Run integration tests via Testcontainers to verify migration and query execution against real PostgreSQL.

---

## 7. Required Tests
- **Real Schema Migration Test:** Verify database migrates from zero to latest without errors.
- **Relational Integrity Tests:** Verify foreign key constraints block orphaned records.
- **Unique Constraint Tests:** Verify duplicate unique keys throw database constraint violations.
- **JSONB Query & Mutation Tests:** Verify full odontogram JSON rounds trips into and out of `jsonb` losslessly.
- **Concurrency Token Test:** Verify conflicting concurrent writes throw `DbUpdateConcurrencyException`.

---

## 8. Definition of Done
- Configuration is clean, explicit, and snake_cased.
- Real foreign keys and unique indexes are defined.
- Migration builds and applies cleanly.
- Testcontainers integration tests pass on Docker against pinned `postgres:16-alpine`.

---

## 9. Related Evidence & Skills
- Evidence: [`docs/backend/reference-audit.md`](file:///e:/alina/React-Advanced-Odontogram/docs/backend/reference-audit.md) (Section 2, Items 51-69; Section 5, Items 3, 4, 7, 8).
- Sibling Skills: `medcanvas-domain-modeling`, `medcanvas-backend-testing`.
