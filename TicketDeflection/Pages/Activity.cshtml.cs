using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace TicketDeflection.Pages;

public class ActivityModel : PageModel
{
    public IActionResult OnGet() => RedirectPermanent("/dashboard");
}
