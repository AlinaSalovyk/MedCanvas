---
name: medcanvas-cqrs-mediatr
description: Implement features using CQRS with MediatR, command/handler conventions, query services, repository abstractions, and pipeline behaviors in MedCanvas.
---

# MedCanvas CQRS & MediatR Skill

## 1. When to Activate This Skill
Activate this skill whenever:
- Adding a new write operation (Command) or read operation (Query) in `MedCanvas.Application`.
- Implementing `IRequestHandler<TRequest, TResponse>`.
- Organizing feature folders in `Application/<Feature>/Commands` or `Queries`.
- Intercepting requests in the MediatR pipeline (`IPipelineBehavior`).
- Connecting controllers to the application core via `IMediator.Send`.

---

## 2. Rules Derived from Reference Architecture
From the verified reference audit (`docs/backend/reference-audit.md`):
1. **Commands as Immutable Records:**
   - Implement `IRequest<TResponse>` using C# positional or init-only `record` types (`CreatePatientCommand : IRequest<PatientDto>`).
2. **Handlers Depend on Ports (Not DbContext):**
   - Command handlers inject write repositories (`IPatientRepository`) and query interfaces (`IPatientQueries`), never raw `ApplicationDbContext`.
3. **CancellationToken Propagation:**
   - Every handler method `Handle(TRequest request, CancellationToken cancellationToken)` must forward `cancellationToken` to all async repository and query calls.
4. **Validation Pipeline Behavior:**
   - `ValidationBehaviour<TRequest, TResponse>` intercepts all MediatR requests before reaching the handler. If validation fails, it throws `ValidationException`.
5. **Separate Query Services (CQS):**
   - Simple reads do not need a MediatR command overhead; they can be queried via `IQueries` directly from controllers or wrapped in MediatR Query handlers when orchestrating complex authorization logic.

---

## 3. MedCanvas-Specific Adaptations
1. **Feature-Oriented Structure:**
   ```
   src/MedCanvas.Application/
     Clinics/
       Commands/
       Queries/
     Patients/
       Commands/CreatePatientCommand.cs
       Commands/CreatePatientCommandHandler.cs
     Encounters/
     Odontograms/
       Commands/SaveOdontogramSnapshotCommand.cs
       Commands/SaveOdontogramSnapshotCommandHandler.cs
       Commands/FinalizeOdontogramRecordCommand.cs
       Queries/GetOdontogramByEncounterQuery.cs
   ```
2. **Optimistic Concurrency in Commands:**
   - Update commands must include a concurrency token / version:
     `UpdateOdontogramSnapshotCommand(Guid RecordId, int ExpectedVersion, ...)`
   - Handlers compare `ExpectedVersion` with database version, throwing `ConflictException` (409/412) on mismatch.
3. **Clinical Audit Event Emission:**
   - State-changing commands trigger an immutable audit event (`ClinicalAuditEvent`) persisted in the same transaction.

---

## 4. Approved Patterns
- **Thin Controllers:** Controllers only translate HTTP request ➔ Command/Query ➔ `_mediator.Send()` ➔ HTTP response.
- **Explicit Transaction Boundaries:** If a command mutates multiple aggregates or writes an audit log, wrap in an explicit transaction or rely on Unit of Work.
- **Fail-Fast Pipeline Validation:** Validation occurs before handler execution, keeping handlers focused on business logic.

---

## 5. Anti-Patterns (Forbidden)
- ❌ Putting business logic or database queries inside API controllers.
- ❌ Swallowing `CancellationToken` in handlers.
- ❌ Mutating command parameters inside the handler.
- ❌ Returning raw domain entities to API clients; always project to DTOs.
- ❌ Modifying database state inside a Query handler.

---

## 6. Implementation Procedure
1. Create command record: `Application/<Feature>/Commands/<Action><Feature>Command.cs`.
2. Define corresponding FluentValidation validator in `Application/Validators/`.
3. Implement handler: `Application/<Feature>/Commands/<Action><Feature>CommandHandler.cs`.
4. Inject necessary `IRepository` and `IQueries` interfaces.
5. In handler:
   - Check entity existence / uniqueness via `IQueries`.
   - Call domain factory/method on entity.
   - Save via `IRepository.AddAsync` or `UpdateAsync` with `cancellationToken`.
   - Return mapped DTO or domain result.
6. Write unit tests for the command handler and validator.

---

## 7. Required Tests
- **Handler Success Tests:** Verify entity is fetched, domain method invoked, and repository saved with matching data.
- **Entity Missing Tests:** Verify `KeyNotFoundException` is thrown when target aggregate does not exist.
- **Conflict / Concurrency Tests:** Verify `ConflictException` is thrown on version mismatch or duplicate key.
- **Cancellation Tests:** Verify `OperationCanceledException` is propagated when token is cancelled.

---

## 8. Definition of Done
- Command and Handler are cleanly separated in feature directory.
- FluentValidation validator is registered and verified.
- `CancellationToken` is fully propagated.
- Unit and integration tests pass with 100% handler logic coverage.

---

## 9. Related Evidence & Skills
- Evidence: [`docs/backend/reference-audit.md`](file:///e:/alina/React-Advanced-Odontogram/docs/backend/reference-audit.md) (Section 3.2, Section 4).
- Sibling Skills: `medcanvas-backend-architecture`, `medcanvas-validation`, `medcanvas-backend-testing`.
