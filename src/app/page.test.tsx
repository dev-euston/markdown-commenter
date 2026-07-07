import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";
import { hasSeenTour, markTourSeen } from "@/lib/tour";

/** Load a Markdown document via the hidden .md file input. */
async function loadMarkdown(container: HTMLElement, text = "# Hello world") {
  const input = container.querySelector(
    'input[accept*=".md"]'
  ) as HTMLInputElement;
  const file = new File([text], "doc.md", { type: "text/markdown" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole("button", { name: "New comments" });
}

/** Load a comments JSON file via the hidden comments input. */
async function loadComments(container: HTMLElement, bodies: string[]) {
  const comments = bodies.map((body, i) => ({
    id: `c${i + 1}`,
    quote: "Hello",
    occurrence: 1,
    author: "Ada",
    body,
    createdAt: new Date(0).toISOString(),
    resolved: false,
  }));
  const json = JSON.stringify({ version: 1, comments });
  const input = container.querySelector(
    'input[accept*=".json"]'
  ) as HTMLInputElement;
  const file = new File([json], "comments.json", { type: "application/json" });
  fireEvent.change(input, { target: { files: [file] } });
  for (const body of bodies) {
    await screen.findByText(body);
  }
}

describe("Home page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("auto-launches the tour for a first-time user", () => {
    render(<Home />);
    expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
  });

  it("does not auto-launch the tour for a returning user", () => {
    markTourSeen();
    render(<Home />);
    expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
  });

  it("re-launches the tour from the Help button in one click, incl. empty state", async () => {
    markTourSeen();
    render(<Home />);
    expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
  });

  it("persists the seen flag when the tour is dismissed via Skip", async () => {
    render(<Home />);
    expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
    expect(hasSeenTour()).toBe(true);
  });

  it("prompts before resetting when comments exist and cancels on decline", async () => {
    markTourSeen();
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: "New comments" }));
    expect(confirm).toHaveBeenCalled();
    // Comment survives a declined reset.
    expect(screen.getByText("a note")).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "New comments" }));
    await waitFor(() =>
      expect(screen.queryByText("a note")).not.toBeInTheDocument()
    );
  });

  it("does not prompt when resetting with no comments", async () => {
    markTourSeen();
    const { container } = render(<Home />);
    await loadMarkdown(container);

    const confirm = vi.spyOn(window, "confirm");
    await userEvent.click(screen.getByRole("button", { name: "New comments" }));
    expect(confirm).not.toHaveBeenCalled();
  });
});
