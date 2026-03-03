#nullable enable

using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace TicketDeflection.Pages;

public class OperatorLoginModel : PageModel
{
    private readonly IConfiguration _config;

    public OperatorLoginModel(IConfiguration config)
    {
        _config = config;
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
            ErrorMessage = "Invalid passphrase.";
            return Page();
        }

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
