import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { PipelineGraph } from "@/components/simulator/pipeline-graph";
import { NodeDetail } from "@/components/simulator/node-detail";

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
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    circle: (props: React.SVGProps<SVGCircleElement>) => <circle {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
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

  it("calls onNodeSelect with the node id when a node is clicked", () => {
    const onNodeSelect = vi.fn();
    render(<PipelineGraph speed={1} onNodeSelect={onNodeSelect} />);
    fireEvent.click(screen.getByLabelText(/Repo Assist/i));
    expect(onNodeSelect).toHaveBeenCalledWith("assist");
  });

  it("activating the first node causes a particle to appear between the first two nodes", async () => {
    render(<PipelineGraph speed={1} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText(/PRD Decomposer/i));
      vi.advanceTimersByTime(100); // past the 50ms reset delay and 0ms activation timeout
    });

    expect(screen.getByLabelText("particle-Issues")).toBeInTheDocument();
  });
});

describe("NodeDetail", () => {
  it("shows the correct panel content for a given nodeId", () => {
    const onClose = vi.fn();
    render(<NodeDetail nodeId="decomposer" onClose={onClose} />);
    expect(screen.getByText("PRD Decomposer")).toBeInTheDocument();
    expect(screen.getByText(/Reads Product Requirements Documents/i)).toBeInTheDocument();
    expect(screen.getByText(/PRD pushed to docs\/prd\//i)).toBeInTheDocument();
    expect(screen.getByText(/GitHub Issues with \[Pipeline\] prefix/i)).toBeInTheDocument();
  });

  it("renders different content when nodeId changes", () => {
    const { rerender } = render(<NodeDetail nodeId="assist" onClose={vi.fn()} />);
    expect(screen.getByText("Repo Assist")).toBeInTheDocument();
    rerender(<NodeDetail nodeId="reviewer" onClose={vi.fn()} />);
    expect(screen.getByText("PR Reviewer")).toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(<NodeDetail nodeId="merge" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close panel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders nothing when nodeId is null", () => {
    const { container } = render(<NodeDetail nodeId={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

