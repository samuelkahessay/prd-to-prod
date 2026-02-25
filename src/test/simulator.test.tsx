import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PipelineGraph } from "@/components/simulator/pipeline-graph";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    g: ({ children, onClick, style, ...rest }: React.HTMLAttributes<SVGGElement> & { onClick?: () => void }) => (
      <g onClick={onClick} style={style} {...rest}>
        {children}
      </g>
    ),
    rect: (props: React.SVGProps<SVGRectElement>) => <rect {...props} />,
    text: ({ children, ...props }: React.SVGProps<SVGTextElement>) => (
      <text {...props}>{children}</text>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("PipelineGraph", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 4 pipeline nodes", () => {
    render(<PipelineGraph speed={1} />);
    expect(screen.getByLabelText(/PRD Decomposer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repo Assist/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PR Reviewer/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Auto-Merge/i)).toBeInTheDocument();
  });

  it("clicking PRD Decomposer activates all 4 nodes in sequence", async () => {
    render(<PipelineGraph speed={2} />);

    const decomposerNode = screen.getByLabelText(/PRD Decomposer/i);
    fireEvent.click(decomposerNode);

    // After all timers: all 4 nodes should be completed
    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.getByLabelText(/PRD Decomposer: completed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repo Assist: completed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/PR Reviewer: completed/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Auto-Merge: completed/i)).toBeInTheDocument();
  });

  it("nodes start in idle state", () => {
    render(<PipelineGraph speed={1} />);
    expect(screen.getByLabelText(/PRD Decomposer: idle/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Repo Assist: idle/i)).toBeInTheDocument();
  });
});
