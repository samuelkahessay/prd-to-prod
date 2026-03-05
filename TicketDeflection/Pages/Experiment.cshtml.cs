using Microsoft.AspNetCore.Mvc.RazorPages;

namespace TicketDeflection.Pages;

public class ExperimentModel : PageModel
{
    public IReadOnlyList<GalleryPhoto> Photos { get; private set; } = [];

    public void OnGet()
    {
        Photos = GalleryPhoto.Curated;
    }
}

public sealed record GalleryPhoto(string Id, string Label, string Alt, int Width, int Height)
{
    // Well-known Unsplash photo IDs curated for a dark tech / AI aesthetic
    public static readonly IReadOnlyList<GalleryPhoto> Curated =
    [
        new("1518770660439-4636190af475", "code stream",           "Glowing code on a dark monitor",            800, 533),
        new("1555066931-bf19f8fd1085",   "terminal depth",         "Dark terminal with neon syntax highlight",  800, 533),
        new("1526374965328-7f61d4dc18c5","matrix rain",            "Green code characters falling on dark bg",  800, 533),
        new("1558494949-ef010cbdcc31",   "data glitch",            "Abstract glitch art in deep blues",         800, 534),
        new("1451187580459-43490279c0fa","orbital view",           "Earth from orbit against the void",         800, 533),
        new("1550751827-4bd374c3f58b",   "city at night",          "City skyline illuminated in darkness",      800, 534),
        new("1620641788421-7a1c342ea42e","neural mesh",            "Abstract neural-network node mesh",         800, 533),
        new("1635070041078-e363dbe005cb","deep signal",            "Colourful abstract AI signal visualised",   800, 533),
        new("1539701938214-0d9736e1c16b","void current",           "Dark abstract flowing energy in the void",  800, 533),
        new("1576669801775-4d8e73f5d46e","syntax layer",           "Lines of code scrolling on dark screen",    800, 533),
        new("1614624532983-4ce71639ab10","circuit macro",          "Close-up of a circuit board, dark macro",   800, 534),
        new("1534972195531-d236914a371a","infrared city",          "City street at night, infrared palette",    800, 533),
    ];

    public string Url(int w = 800, int h = 600) =>
        $"https://images.unsplash.com/photo-{Id}?w={w}&h={h}&auto=format&fit=crop&q=80";

    public string UrlSmall() => Url(600, 450);
}
