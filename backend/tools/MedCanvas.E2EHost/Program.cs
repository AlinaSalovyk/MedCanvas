using System.Net;
using System.Runtime.InteropServices;
using MedCanvas.Api.IntegrationTests.Infrastructure;

// Test-only executable: the production ASP.NET pipeline on loopback, backed by
// the existing isolated PostgreSQL Testcontainer and migrations. No seed endpoints.
var factory = new MedCanvasApiFactory();
factory.UseKestrel(options => options.Listen(IPAddress.Loopback, 5188));
using var shutdown = new CancellationTokenSource();
Console.CancelKeyPress += (_, args) => { args.Cancel = true; shutdown.Cancel(); };
using var termination = OperatingSystem.IsWindows() ? null : PosixSignalRegistration.Create(PosixSignal.SIGTERM,
    context => { context.Cancel = true; shutdown.Cancel(); });
try
{
    await factory.InitializeAsync();
    factory.StartServer();
    Console.WriteLine("MedCanvas isolated full-stack API ready on http://127.0.0.1:5188");
    await Task.Delay(Timeout.Infinite, shutdown.Token);
}
catch (OperationCanceledException) when (shutdown.IsCancellationRequested) { }
finally
{
    await factory.DisposeAsync();
}
