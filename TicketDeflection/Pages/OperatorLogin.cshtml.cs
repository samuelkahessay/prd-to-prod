#nullable enable

using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using TicketDeflection.Services;

namespace TicketDeflection.Pages;

public class OperatorLoginModel : PageModel
{
    private readonly IConfiguration _config;
    private readonly IOperatorLoginThrottle _throttle;

    public OperatorLoginModel(IConfiguration config, IOperatorLoginThrottle throttle)
    {
        _config = config;
        _throttle = throttle;
    }

    [BindProperty]
    public string OperatorName { get; set; } = string.Empty;

    [BindProperty]
    public string Passphrase { get; set; } = string.Empty;

    public string? ErrorMessage { get; set; }

    public string? ReturnUrl { get; set; }

    public void OnGet(string? returnUrl = null)
    {
        ReturnUrl = returnUrl;
    }

    public async Task<IActionResult> OnPostAsync(string? returnUrl = null)
    {
        if (_throttle.IsBlocked(HttpContext, out var retryAfter))
        {
            var retryAfterSeconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
            Response.Headers.RetryAfter = retryAfterSeconds.ToString(CultureInfo.InvariantCulture);
            return StatusCode(StatusCodes.Status429TooManyRequests);
        }

        var configuredPassphrase = _config["OperatorAuth:Passphrase"];
        if (string.IsNullOrEmpty(configuredPassphrase))
            configuredPassphrase = Environment.GetEnvironmentVariable("OPERATOR_PASSPHRASE");
        configuredPassphrase ??= string.Empty;

        if (string.IsNullOrEmpty(configuredPassphrase))
        {
            ErrorMessage = "Operator auth not configured. Set OperatorAuth:Passphrase or OPERATOR_PASSPHRASE.";
            return Page();
        }

        if (string.IsNullOrWhiteSpace(OperatorName))
        {
            ErrorMessage = "Operator name is required.";
            return Page();
        }

        if (Passphrase != configuredPassphrase)
        {
            _throttle.RecordFailure(HttpContext);
            ErrorMessage = "Invalid passphrase.";
            return Page();
        }

        _throttle.Reset(HttpContext);

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, OperatorName.Trim()),
            new("OperatorRole", "operator"),
        };
        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

        return LocalRedirect(returnUrl ?? "/compliance");
    }
}
