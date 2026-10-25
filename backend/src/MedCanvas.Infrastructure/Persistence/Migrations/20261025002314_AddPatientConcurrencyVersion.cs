using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedCanvas.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientConcurrencyVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ConcurrencyVersion",
                table: "Patients",
                type: "integer",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConcurrencyVersion",
                table: "Patients");
        }
    }
}
