using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedCanvas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddEncounterAppointmentLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "AppointmentId",
                table: "DentalEncounters",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_DentalEncounters_AppointmentId",
                table: "DentalEncounters",
                column: "AppointmentId");

            migrationBuilder.AddForeignKey(
                name: "FK_DentalEncounters_Appointments_AppointmentId",
                table: "DentalEncounters",
                column: "AppointmentId",
                principalTable: "Appointments",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_DentalEncounters_Appointments_AppointmentId",
                table: "DentalEncounters");

            migrationBuilder.DropIndex(
                name: "IX_DentalEncounters_AppointmentId",
                table: "DentalEncounters");

            migrationBuilder.DropColumn(
                name: "AppointmentId",
                table: "DentalEncounters");
        }
    }
}
