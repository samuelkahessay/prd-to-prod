/** @jest-environment node */
import fs from "node:fs";
import path from "node:path";
import config from "../next.config";

// The hosted beta is retired. The landing, showcase, vision, and case study
// stay browsable inside the archive frame on skahessay.dev; the flows that
// needed the backend send visitors home instead.
describe("archived site config", () => {
  it("serves the site instead of redirecting every path away", async () => {
    const redirects = await config.redirects!();

    expect(redirects.map((redirect) => redirect.source)).not.toContain("/:path*");
    for (const redirect of redirects) {
      expect(redirect.destination).toBe("/");
      expect(redirect.permanent).toBe(false);
    }

    const vercelConfig = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "vercel.json"), "utf8"),
    );
    expect(vercelConfig.redirects).toBeUndefined();
  });

  it.each(["build", "console", "demo"])(
    "sends the retired /%s flow home, including nested paths",
    async (flow) => {
      const sources = (await config.redirects!()).map((redirect) => redirect.source);

      expect(sources).toContain(`/${flow}`);
      expect(sources).toContain(`/${flow}/:path*`);
    },
  );

  it("does not proxy to the retired backend", async () => {
    expect(config.rewrites).toBeUndefined();
  });

  it("allows framing by skahessay.dev only and stays out of search indexes", async () => {
    const rules = await config.headers!();
    const catchAll = rules.find((rule) => rule.source === "/(.*)");
    const headers = Object.fromEntries(
      catchAll!.headers.map((header) => [header.key, header.value]),
    );

    // Outside production the config also allows localhost for frame testing.
    const sources = headers["Content-Security-Policy"]
      .replace("frame-ancestors ", "")
      .split(" ")
      .filter((source: string) => source !== "http://localhost:*");
    expect(sources).toEqual(["'self'", "https://skahessay.dev"]);
    expect(headers["X-Robots-Tag"]).toBe("noindex");
    expect(headers).not.toHaveProperty("X-Frame-Options");
  });
});
