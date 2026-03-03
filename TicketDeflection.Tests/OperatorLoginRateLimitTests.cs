using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TicketDeflection.Tests;

public class OperatorLoginRateLimitTests
{
    [Fact]
    public async Task OperatorLogin_Get_IsNotRateLimited()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        for (var i = 0; i < 6; i++)
        {
            var response = await client.GetAsync("/operator/login");
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task OperatorLogin_Post_IsRateLimited()
    {
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                TestFactoryExtensions.ReplaceDbWithInMemory(services, $"TestDb_{Guid.NewGuid()}");
            });
        });

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false
        });

        var token = await GetRequestVerificationTokenAsync(client);

        var sawThrottle = false;

        for (var i = 0; i < 6; i++)
        {
            var response = await client.PostAsync("/operator/login", new FormUrlEncodedContent(
            [
                new KeyValuePair<string, string>("__RequestVerificationToken", token),
                new KeyValuePair<string, string>("OperatorName", "operator"),
                new KeyValuePair<string, string>("Passphrase", "wrong-passphrase")
            ]));

            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                sawThrottle = true;
                break;
            }
        }

        Assert.True(sawThrottle);
    }

    private static async Task<string> GetRequestVerificationTokenAsync(HttpClient client)
    {
        var html = await client.GetStringAsync("/operator/login");
        var match = Regex.Match(html, "name=\"__RequestVerificationToken\" type=\"hidden\" value=\"([^\"]+)\"");
        Assert.True(match.Success);
        return match.Groups[1].Value;
    }
}
