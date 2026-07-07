import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingTour from "./OnboardingTour";
import { TOUR_STEPS, type TourStep } from "@/lib/tour";

describe("OnboardingTour", () => {
  it("renders the first step title, body and step counter", () => {
    render(<OnboardingTour steps={TOUR_STEPS} onClose={() => {}} />);
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeInTheDocument();
    expect(screen.getByText(TOUR_STEPS[0].body)).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("advances through all three steps in order via Next", async () => {
    render(<OnboardingTour steps={TOUR_STEPS} onClose={() => {}} />);
    expect(screen.getByText(TOUR_STEPS[0].title)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(TOUR_STEPS[1].title)).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(TOUR_STEPS[2].title)).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
  });

  it("shows Done on the last step and calls onClose when clicked", async () => {
    const onClose = vi.fn();
    render(<OnboardingTour steps={TOUR_STEPS} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toBeInTheDocument();
    await userEvent.click(done);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when Skip is clicked", async () => {
    const onClose = vi.fn();
    render(<OnboardingTour steps={TOUR_STEPS} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose on Escape", async () => {
    const onClose = vi.fn();
    render(<OnboardingTour steps={TOUR_STEPS} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("disables Back on the first step and navigates backward otherwise", async () => {
    render(<OnboardingTour steps={TOUR_STEPS} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  it("renders step text without throwing when the target matches no element", () => {
    const steps: TourStep[] = [
      {
        id: "missing",
        title: "Missing target step",
        body: "This control is not rendered right now.",
        target: '[data-tour="does-not-exist"]',
      },
    ];
    render(<OnboardingTour steps={steps} onClose={() => {}} />);
    expect(
      screen.getByText("This control is not rendered right now.")
    ).toBeInTheDocument();
  });
});
