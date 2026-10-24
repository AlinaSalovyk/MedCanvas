using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedCanvas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClinicTimeZone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TimeZoneId",
                table: "Clinics",
                type: "character varying(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "Europe/Kyiv");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TimeZoneId",
                table: "Clinics");
        }
    }
}
