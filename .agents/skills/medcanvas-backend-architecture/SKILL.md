---
name: medcanvas-backend-architecture
description: Apply the approved MedCanvas Clean Architecture, layer boundary rules, and dependency injection conventions whenever designing or modifying backend components.
---

# MedCanvas Backend Architecture Skill

## 1. When to Activate This Skill
Activate this skill whenever:
- Designing new backend projects, namespaces, or folder structures in `backend/`.
- Adding dependencies or project references between `Api`, `Application`, `Domain`, and `Infrastructure`.
- Registering services in dependency injection (`ConfigureServices.cs` or `Program.cs`).
- Evaluating whether a new feature or type belongs in Domain, Application, Infrastructure, or Api.
- Refactoring existing backend code to preserve architectural integrity.

---

## 2. Rules Derived from Reference Architecture
From the verified reference audit (`docs/backend/reference-audit.md`):
1. **Strict Dependency Inversion:**
   - `Domain` has **zero** package dependencies and references no other projects.
   - `Application` references **Domain** only. Never reference `Infrastructure` or `Api`.
   - `Infrastructure` references **Application** (and transitively `Domain`). Never reference `Api`.
   - `Api` references **Application** and **Infrastructure** as the composition root.
2. **Modular Service Registration:**
   - Every layer exposes an `IServiceCollection` extension method (`AddApplicationServices`, `AddInfrastructureServices`).
   - `Program.cs` stays thin and orchestrates high-level modules only.
3. **No Circular Dependencies:**
   - Cycles between projects or namespaces are strictly prohibited and verified by architectural tests.
4. **Command-Query Separation (CQS) at Port Boundary:**
   - Write operations belong in dedicated repositories (`IRepository`).
   - Read operations belong in dedicated query services (`IQueries`).

---

## 3. MedCanvas-Specific Adaptations
1. **Target Framework:** Use **.NET 10 LTS** (`net10.0`), not .NET 9.
2. **Dental Health Domain Organization:**
   - Features in `Application` are organized by clinical aggregate: `Clinics`, `Patients`, `Encounters`, `Odontograms`, `TreatmentPlans`.
3. **Separation of Clinical Status and Plan:**
   - The architecture must structurally accommodate dual-state charting (Status vs. Plan) without polluting core domain models.
4. **JSONB Canonical Storage Integration:**
   - `Infrastructure` encapsulates PostgreSQL `jsonb` mapping and serialization logic; `Domain` operates on strongly-typed aggregate roots.

---

## 4. Approved Patterns
- **Onion / Clean Architecture:** Clear concentric layers with inner layers oblivious to outer layers.
- **Port and Adapter (Hexagonal):** Application defines interfaces (ports); Infrastructure and Api implement them (adapters).
- **Extension Method Module Registration:** Clean encapsulation of DI bindings per layer.
- **Record DTOs:** Immutable C# records with `init` accessors for data transfer.

---

## 5. Anti-Patterns (Forbidden)
- ❌ Direct EF Core `DbContext` access from controllers.
- ❌ Leaking HTTP concerns (`HttpContext`, `IActionResult`, status codes) into `Application` or `Domain`.
- ❌ Generic repository anti-patterns (`IRepository<T>` with 50 methods like `GetAll().Where(...)`).
- ❌ Anemic domain models with public parameterless constructors and public property setters.
- ❌ Skipping the Application layer by placing SQL queries directly in controllers.

---

## 6. Implementation Procedure
1. Verify layer ownership:
   - Does this concept express pure business rules? ➔ `MedCanvas.Domain`
   - Does it orchestrate a use case or command? ➔ `MedCanvas.Application`
   - Does it talk to PostgreSQL, files, or external networks? ➔ `MedCanvas.Infrastructure`
   - Does it handle HTTP requests, routing, or OpenAPI? ➔ `MedCanvas.Api`
2. Define domain models with encapsulated state.
3. Declare repository/query port interfaces in `Application.Interfaces`.
4. Implement handlers in `Application.<Feature>.Commands` or `Queries`.
5. Implement adapters in `Infrastructure.Persistence`.
6. Expose endpoints in `Api.Controllers.<Feature>Controller.cs`.
7. Wire up DI registrations in corresponding `ConfigureServices.cs`.

---

## 7. Required Tests
- **Architecture Invariant Tests (`NetArchTest.Rules` or custom reflection tests):**
  - Verify `Domain` has no dependencies on `Application`, `Infrastructure`, or `Api`.
  - Verify `Application` has no dependency on `Infrastructure` or `Api`.
  - Verify controllers do not directly reference `ApplicationDbContext`.

---

## 8. Definition of Done
- All project references strictly adhere to the inward clean architecture rule.
- DI registration is modularized in `ConfigureServices.cs`.
- Architecture dependency unit tests pass with zero violations.
- Code compiles cleanly with zero warnings under `<Nullable>enable</Nullable>`.

---

## 9. Related Evidence & Skills
- Evidence: [`docs/backend/reference-audit.md`](file:///e:/alina/React-Advanced-Odontogram/docs/backend/reference-audit.md) (Sections 3.1 & 3.2).
- Sibling Skills: `medcanvas-domain-modeling`, `medcanvas-cqrs-mediatr`, `medcanvas-postgresql-efcore`.
