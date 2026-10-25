using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedCanvas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSchedulingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClinicChairs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClinicChairs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClinicChairs_Clinics_ClinicId",
                        column: x => x.ClinicId,
                        principalTable: "Clinics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProviderAvailabilities",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicianUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DayOfWeek = table.Column<int>(type: "integer", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProviderAvailabilities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProviderAvailabilities_Users_ClinicianUserId",
                        column: x => x.ClinicianUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProviderAvailabilityExceptions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicianUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    IsWorkingDay = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProviderAvailabilityExceptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProviderAvailabilityExceptions_Users_ClinicianUserId",
                        column: x => x.ClinicianUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Appointments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicianUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChairId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReasonForVisit = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    InternalNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CancellationReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ConcurrencyVersion = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Appointments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Appointments_ClinicChairs_ChairId",
                        column: x => x.ChairId,
                        principalTable: "ClinicChairs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Appointments_Patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "Patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProviderAvailabilityBreaks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProviderAvailabilityId = table.Column<Guid>(type: "uuid", nullable: false),
                    StartTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    EndTime = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProviderAvailabilityBreaks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProviderAvailabilityBreaks_ProviderAvailabilities_ProviderA~",
                        column: x => x.ProviderAvailabilityId,
                        principalTable: "ProviderAvailabilities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_ChairId",
                table: "Appointments",
                column: "ChairId");

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_ClinicId_ClinicianUserId_StartAtUtc",
                table: "Appointments",
                columns: new[] { "ClinicId", "ClinicianUserId", "StartAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_ClinicId_StartAtUtc",
                table: "Appointments",
                columns: new[] { "ClinicId", "StartAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Appointments_PatientId_StartAtUtc",
                table: "Appointments",
                columns: new[] { "PatientId", "StartAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ClinicChairs_ClinicId_Name",
                table: "ClinicChairs",
                columns: new[] { "ClinicId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProviderAvailabilities_ClinicianUserId",
                table: "ProviderAvailabilities",
                column: "ClinicianUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProviderAvailabilities_ClinicId_ClinicianUserId_DayOfWeek",
                table: "ProviderAvailabilities",
                columns: new[] { "ClinicId", "ClinicianUserId", "DayOfWeek" });

            migrationBuilder.CreateIndex(
                name: "IX_ProviderAvailabilityBreaks_ProviderAvailabilityId",
                table: "ProviderAvailabilityBreaks",
                column: "ProviderAvailabilityId");

            migrationBuilder.CreateIndex(
                name: "IX_ProviderAvailabilityExceptions_ClinicianUserId",
                table: "ProviderAvailabilityExceptions",
                column: "ClinicianUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProviderAvailabilityExceptions_ClinicId_ClinicianUserId_Date",
                table: "ProviderAvailabilityExceptions",
                columns: new[] { "ClinicId", "ClinicianUserId", "Date" },
                unique: true);

            // INV-005: overlap prevention at the database boundary. Active appointments
            // (Scheduled=0, Confirmed=1, Arrived=2, InProgress=3) may not overlap in time
            // for the same clinician or the same chair within a clinic. Cancelled/NoShow
            // slots are reusable. Concurrent double-bookings race-safely violate the
            // constraint (exclusion_violation 23P01), which handlers map to 409.
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS btree_gist;");

            migrationBuilder.Sql(
                """
                ALTER TABLE "Appointments"
                ADD CONSTRAINT "CK_Appointments_NoClinicianOverlap"
                EXCLUDE USING gist (
                    "ClinicId" WITH =,
                    "ClinicianUserId" WITH =,
                    tstzrange("StartAtUtc", "EndAtUtc") WITH &&
                ) WHERE ("Status" IN (0, 1, 2, 3));
                """);

            migrationBuilder.Sql(
                """
                ALTER TABLE "Appointments"
                ADD CONSTRAINT "CK_Appointments_NoChairOverlap"
                EXCLUDE USING gist (
                    "ClinicId" WITH =,
                    "ChairId" WITH =,
                    tstzrange("StartAtUtc", "EndAtUtc") WITH &&
                ) WHERE ("Status" IN (0, 1, 2, 3));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE \"Appointments\" DROP CONSTRAINT IF EXISTS \"CK_Appointments_NoChairOverlap\";");
            migrationBuilder.Sql("ALTER TABLE \"Appointments\" DROP CONSTRAINT IF EXISTS \"CK_Appointments_NoClinicianOverlap\";");

            migrationBuilder.DropTable(
                name: "Appointments");

            migrationBuilder.DropTable(
                name: "ProviderAvailabilityBreaks");

            migrationBuilder.DropTable(
                name: "ProviderAvailabilityExceptions");

            migrationBuilder.DropTable(
                name: "ClinicChairs");

            migrationBuilder.DropTable(
                name: "ProviderAvailabilities");
        }
    }
}
