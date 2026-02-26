import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TopRepos from "../top-repos";
import sampleUser from "@/data/fixtures/sample-user.json";
import type { DevCardData, GitHubRepo } from "@/data/types";

const fixtureData = sampleUser as DevCardData;

describe("TopRepos", () => {
  it("renders exactly 3 repo entries from fixture data", () => {
    render(<TopRepos repos={fixtureData.topRepos} />);
    // fixture has 6 repos, only top 3 by stars should show
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
  });

  it("repo names appear in the rendered output", () => {
    render(<TopRepos repos={fixtureData.topRepos} />);
    // Top 3 by star: Spoon-Knife (12000), Hello-World (2300), linguist (1200)
    expect(screen.getByText("Spoon-Knife")).toBeInTheDocument();
    expect(screen.getByText("Hello-World")).toBeInTheDocument();
    expect(screen.getByText("linguist")).toBeInTheDocument();
  });

  it("shows No public repositories for empty repos", () => {
    render(<TopRepos repos={[]} />);
    expect(screen.getByText("No public repositories")).toBeInTheDocument();
  });
});
