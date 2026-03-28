import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import AnimationPage from "@/app/animation/page";

let mountCount = 0;

jest.mock("@/components/shared/prd-to-prod-animation", () => {
  const React = require("react");

  return {
    PrdToProdAnimation: ({ amplitude = "medium" }: { amplitude?: string }) => {
      const [instanceId] = React.useState(() => ++mountCount);

      return (
        <div data-testid="animation-instance" data-instance={instanceId}>
          {amplitude}
        </div>
      );
    },
  };
});

jest.mock("@/hooks/use-animation-sound", () => {
  const React = require("react");

  return {
    TRACKS: [
      { value: "percussive", label: "Percussive", desc: "Impact hits + noise. Sound effects." },
      { value: "melodic", label: "Melodic", desc: "Em7 phrase. Musical." },
    ],
    useAnimationSound: () => {
      const [enabled, setEnabled] = React.useState(false);

      return {
        enabled,
        enable: async () => {
          setEnabled(true);
          return true;
        },
        disable: () => setEnabled(false),
        toggle: async () => {
          if (enabled) {
            setEnabled(false);
            return false;
          }

          setEnabled(true);
          return true;
        },
      };
    },
  };
});

function getAnimationInstance() {
  return screen.getByTestId("animation-instance").getAttribute("data-instance");
}

beforeEach(() => {
  mountCount = 0;
});

describe("AnimationPage", () => {
  it("restarts the animation when sound is enabled", async () => {
    render(<AnimationPage />);

    expect(getAnimationInstance()).toBe("1");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    });

    expect(screen.getByRole("button", { name: "Mute sound" })).toBeInTheDocument();
    expect(getAnimationInstance()).toBe("2");
  });

  it("does not restart the animation when switching tracks with sound off", () => {
    render(<AnimationPage />);

    fireEvent.click(screen.getByRole("button", { name: /Percussive/ }));

    expect(getAnimationInstance()).toBe("1");
  });

  it("restarts the animation when switching tracks with sound on", async () => {
    render(<AnimationPage />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enable sound" }));
    });

    expect(getAnimationInstance()).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: /Percussive/ }));

    expect(getAnimationInstance()).toBe("3");
  });
});
