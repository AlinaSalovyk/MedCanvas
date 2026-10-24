namespace MedCanvas.Api.Middleware;

/// <summary>
/// Adds baseline security response headers to every response
/// (defense-in-depth alongside gateway/TLS controls).
/// </summary>
public sealed class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            return Task.CompletedTask;
        });

        return _next(context);
    }
}
