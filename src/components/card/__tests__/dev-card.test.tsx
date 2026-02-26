import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DevCard from "../dev-card";
import sampleUser from "@/data/fixtures/sample-user.json";
import type { DevCardData } from "@/data/types";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));

const fixtureData = sampleUser as DevCardData;

describe("DevCard", () => {
  it("renders avatar img with correct alt text", () => {
    render(<DevCard data={fixtureData} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "The Octocat's avatar");
  });

  it("renders display name and @login", () => {
    render(<DevCard data={fixtureData} />);
    expect(screen.getByText("The Octocat")).toBeInTheDocument();
    expect(screen.getByText("@octocat")).toBeInTheDocument();
  });

  it("renders stats row with correct repo/follower counts", () => {
    render(<DevCard data={fixtureData} />);
    expect(screen.getByText("8 repos")).toBeInTheDocument();
    expect(screen.getByText("15000 followers")).toBeInTheDocument();
    expect(screen.getByText("9 following")).toBeInTheDocument();
  });

  it("does not render bio element when bio is null", () => {
    const noBio: DevCardData = {
      ...fixtureData,
      user: { ...fixtureData.user, bio: null },
    };
    render(<DevCard data={noBio} />);
    expect(screen.queryByText("A mysterious entity that loves Git.")).not.toBeInTheDocument();
  });
});
