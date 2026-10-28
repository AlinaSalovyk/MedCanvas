using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedCanvas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProtectPlannedExecution : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_PerformedProcedures_TreatmentPlanItemId",
                table: "PerformedProcedures",
                column: "TreatmentPlanItemId",
                unique: true,
                filter: "\"TreatmentPlanItemId\" IS NOT NULL AND \"Status\" = 'Recorded'");

            migrationBuilder.AddForeignKey(
                name: "FK_PerformedProcedures_TreatmentPlanItems_TreatmentPlanItemId",
                table: "PerformedProcedures",
                column: "TreatmentPlanItemId",
                principalTable: "TreatmentPlanItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PerformedProcedures_TreatmentPlanItems_TreatmentPlanItemId",
                table: "PerformedProcedures");

            migrationBuilder.DropIndex(
                name: "IX_PerformedProcedures_TreatmentPlanItemId",
                table: "PerformedProcedures");
        }
    }
}
