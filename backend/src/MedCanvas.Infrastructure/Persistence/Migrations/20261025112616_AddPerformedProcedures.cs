using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedCanvas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerformedProcedures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ItemStatus",
                table: "TreatmentPlanItems",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "PerformedProcedures",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    EncounterId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    ProcedureCatalogItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToothFdi = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    PerformedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    UnitPriceSnapshot = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    ClinicalNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IdempotencyKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    VoidReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    VoidedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    VoidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerformedProcedures", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PerformedProcedures_Clinics_ClinicId",
                        column: x => x.ClinicId,
                        principalTable: "Clinics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PerformedProcedures_DentalEncounters_EncounterId",
                        column: x => x.EncounterId,
                        principalTable: "DentalEncounters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PerformedProcedures_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PerformedProcedures_ProcedureCatalogItems_ProcedureCatalogI~",
                        column: x => x.ProcedureCatalogItemId,
                        principalTable: "ProcedureCatalogItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PerformedProcedures_ClinicId_EncounterId",
                table: "PerformedProcedures",
                columns: new[] { "ClinicId", "EncounterId" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformedProcedures_ClinicId_IdempotencyKey",
                table: "PerformedProcedures",
                columns: new[] { "ClinicId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerformedProcedures_EncounterId",
                table: "PerformedProcedures",
                column: "EncounterId");

            migrationBuilder.CreateIndex(
                name: "IX_PerformedProcedures_PatientId_CreatedAtUtc",
                table: "PerformedProcedures",
                columns: new[] { "PatientId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_PerformedProcedures_ProcedureCatalogItemId",
                table: "PerformedProcedures",
                column: "ProcedureCatalogItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PerformedProcedures");

            migrationBuilder.DropColumn(
                name: "ItemStatus",
                table: "TreatmentPlanItems");
        }
    }
}
