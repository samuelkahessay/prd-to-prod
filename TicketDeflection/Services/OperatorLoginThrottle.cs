#nullable enable

using System.Collections.Concurrent;

namespace TicketDeflection.Services;

public interface IOperatorLoginThrottle
{
    bool IsBlocked(HttpContext httpContext, out TimeSpan retryAfter);
    void RecordFailure(HttpContext httpContext);
    void Reset(HttpContext httpContext);
}

public sealed class OperatorLoginThrottle : IOperatorLoginThrottle
{
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(1);
    private const int PermitLimit = 5;

    private readonly ConcurrentDictionary<string, FailureWindow> _windows = new(StringComparer.Ordinal);

    public bool IsBlocked(HttpContext httpContext, out TimeSpan retryAfter)
    {
        var key = GetPartitionKey(httpContext);
        if (!_windows.TryGetValue(key, out var state))
        {
            retryAfter = TimeSpan.Zero;
            return false;
        }

        lock (state)
        {
            var now = DateTimeOffset.UtcNow;
            if (now - state.WindowStart >= Window)
            {
                _windows.TryRemove(key, out _);
                retryAfter = TimeSpan.Zero;
                return false;
            }

            if (state.FailureCount < PermitLimit)
            {
                retryAfter = TimeSpan.Zero;
                return false;
            }

            retryAfter = Window - (now - state.WindowStart);
            return true;
        }
    }

    public void RecordFailure(HttpContext httpContext)
    {
        var key = GetPartitionKey(httpContext);
        var now = DateTimeOffset.UtcNow;
        var state = _windows.GetOrAdd(key, _ => new FailureWindow(now));

        lock (state)
        {
            if (now - state.WindowStart >= Window)
            {
                state.WindowStart = now;
                state.FailureCount = 1;
                return;
            }

            state.FailureCount++;
        }
    }

    public void Reset(HttpContext httpContext)
    {
        var key = GetPartitionKey(httpContext);
        _windows.TryRemove(key, out _);
    }

    private static string GetPartitionKey(HttpContext httpContext) =>
        httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    private sealed class FailureWindow(DateTimeOffset windowStart)
    {
        public DateTimeOffset WindowStart { get; set; } = windowStart;
        public int FailureCount { get; set; }
    }
}
