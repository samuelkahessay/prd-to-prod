import { describe, it, expect, vi } from "vitest";
import { getDevCardData } from "../index";
import type { DevCardData } from "../types";

// Mock the github module so tests don't make real API calls
vi.mock("../github", () => ({
  fetchGitHubUser: vi.fn().mockRejectedValue(new Error("API unavailable")),
}));

describe("getDevCardData", () => {
  it("returns fixture data for 'octocat' when the API throws", async () => {
    const data = await getDevCardData("octocat");
    expect(data.user.login).toBe("octocat");
    expect(data.topRepos).toBeInstanceOf(Array);
    expect(data.languages).toBeInstanceOf(Array);
    expect(typeof data.contributions.totalContributions).toBe("number");
  });

  it("throws for non-octocat usernames when the API fails", async () => {
    await expect(getDevCardData("nonexistent-user-xyz")).rejects.toThrow();
  });
});

describe("fixture data shape", () => {
  it("fixture JSON parses correctly and satisfies the DevCardData shape", async () => {
    const data = await getDevCardData("octocat");
    const d = data as DevCardData;

    // user fields
    expect(typeof d.user.login).toBe("string");
    expect(typeof d.user.publicRepos).toBe("number");
    expect(typeof d.user.followers).toBe("number");
    expect(typeof d.user.following).toBe("number");
    expect(typeof d.user.createdAt).toBe("string");

    // topRepos
    expect(d.topRepos.length).toBeGreaterThan(0);
    const repo = d.topRepos[0];
    expect(typeof repo.name).toBe("string");
    expect(typeof repo.stargazerCount).toBe("number");
    expect(Array.isArray(repo.topics)).toBe(true);

    // languages
    expect(d.languages.length).toBeGreaterThan(0);
    const totalPct = d.languages.reduce((s, l) => s + l.percentage, 0);
    expect(totalPct).toBe(100);

    // contributions
    expect(typeof d.contributions.totalContributions).toBe("number");
    expect(typeof d.contributions.currentStreak).toBe("number");
    expect(typeof d.contributions.longestStreak).toBe("number");
    expect(typeof d.contributions.contributionsLastYear).toBe("number");
  });
});
