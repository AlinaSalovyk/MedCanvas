using MediatR;

namespace MedCanvas.Application.Features.Dashboard;

public sealed record ClinicDashboardDto(
    int TodaysAppointments,
    int WaitingPatients,
    int InProgressEncounters,
    int CompletedToday,
    int UpcomingAppointments7Days,
    int InvoicesIssuedToday,
    decimal SimulatedPaymentsToday,
    bool FinanceIsDemo);

public sealed record GetClinicDashboardQuery : IRequest<ClinicDashboardDto>;
