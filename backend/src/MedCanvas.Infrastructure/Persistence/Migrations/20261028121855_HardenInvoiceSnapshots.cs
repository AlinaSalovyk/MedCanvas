using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedCanvas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class HardenInvoiceSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasLineSnapshot",
                table: "Invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "InvoiceItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InvoiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    PerformedProcedureId = table.Column<Guid>(type: "uuid", nullable: false),
                    CodeSnapshot = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DescriptionSnapshot = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: false),
                    ToothFdi = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPriceSnapshot = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    TotalAmount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InvoiceItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InvoiceItems_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InvoiceItems_PerformedProcedures_PerformedProcedureId",
                        column: x => x.PerformedProcedureId,
                        principalTable: "PerformedProcedures",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Invoices_ClinicId_EncounterId",
                table: "Invoices",
                columns: new[] { "ClinicId", "EncounterId" },
                unique: true,
                filter: "\"Status\" <> 'Voided'");

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_InvoiceId_PerformedProcedureId",
                table: "InvoiceItems",
                columns: new[] { "InvoiceId", "PerformedProcedureId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InvoiceItems_PerformedProcedureId",
                table: "InvoiceItems",
                column: "PerformedProcedureId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InvoiceItems");

            migrationBuilder.DropIndex(
                name: "IX_Invoices_ClinicId_EncounterId",
                table: "Invoices");

            migrationBuilder.DropColumn(
                name: "HasLineSnapshot",
                table: "Invoices");
        }
    }
}
