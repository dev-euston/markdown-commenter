import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Comment } from "@/lib/comments";
import MermaidBlock, { MermaidContext, type MermaidContextValue } from "./MermaidBlock";

vi.mock("@/lib/mermaid", () => ({
  renderMermaid: vi.fn().mockResolvedValue("<svg data-testid='diagram'></svg>"),
}));

const SOURCE = "graph TD; A-->B";

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    quote: "A-->B",
    occurrence: 1,
    author: "Ada",
    body: "a note",
    createdAt: new Date(0).toISOString(),
    resolved: false,
    ...overrides,
  };
}

function renderBlock(
  ctx: Partial<MermaidContextValue> = {},
  source = SOURCE
) {
  const value: MermaidContextValue = {
    comments: [],
    activeId: null,
    setActiveId: vi.fn(),
    onToggle: vi.fn(),
    ...ctx,
  };
  const utils = render(
    <MermaidContext.Provider value={value}>
      <MermaidBlock source={source} />
    </MermaidContext.Provider>
  );
  return { ...utils, value };
}

describe("MermaidBlock", () => {
  it("renders the diagram svg by default and no raw selectable source", async () => {
    const { container } = renderBlock();
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );
    expect(container.querySelector("pre")).toBeNull();
  });

  it("toggles to source view showing the exact raw source, and back", async () => {
    const { container, value } = renderBlock();
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    await userEvent.click(screen.getByRole("button", { name: "Show source" }));
    expect(value.onToggle).toHaveBeenCalledTimes(1);
    const pre = container.querySelector("pre code");
    expect(pre?.textContent).toBe(SOURCE);
    expect(container.querySelector(".md-mermaid-diagram")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Show diagram" }));
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );
  });

  it("highlights the diagram when a comment's quote is in the source and activates on click", async () => {
    const setActiveId = vi.fn();
    const { container } = renderBlock({
      comments: [comment({ id: "cx", quote: "A-->B" })],
      setActiveId,
    });
    const diagram = await waitFor(() => {
      const el = container.querySelector(".md-mermaid-diagram");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(diagram.classList.contains("has-comment")).toBe(true);
    expect(diagram.getAttribute("data-comment-id")).toBe("cx");

    fireEvent.click(diagram);
    expect(setActiveId).toHaveBeenCalledWith("cx");
  });

  it("adds the active class when activeId matches a commented id", async () => {
    const { container } = renderBlock({
      comments: [comment({ id: "cx", quote: "A-->B" })],
      activeId: "cx",
    });
    const diagram = await waitFor(() => {
      const el = container.querySelector(".md-mermaid-diagram");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(diagram.classList.contains("is-active")).toBe(true);
  });

  it("has no highlight and no activation when no comment matches", async () => {
    const setActiveId = vi.fn();
    const { container } = renderBlock({
      comments: [comment({ id: "cx", quote: "not present" })],
      setActiveId,
    });
    const diagram = await waitFor(() => {
      const el = container.querySelector(".md-mermaid-diagram");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(diagram.classList.contains("has-comment")).toBe(false);
    fireEvent.click(diagram);
    expect(setActiveId).not.toHaveBeenCalled();
  });
});
