import { render, screen } from "@testing-library/react";
import Home from "../page";

describe("Home page", () => {
  it("renders the DevCard heading", () => {
    render(<Home />);
    expect(screen.getByText("DevCard")).toBeInTheDocument();
  });
});
