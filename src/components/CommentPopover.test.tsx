import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CommentPopover, { type PendingAnchor } from "./CommentPopover";

const anchor: PendingAnchor = {
  quote: "anchored text",
  occurrence: 1,
  x: 100,
  y: 200,
};

describe("CommentPopover", () => {
  it("renders the anchored quote", () => {
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor=""
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByText(/anchored text/)).toBeInTheDocument();
  });

  it("prefills the author from defaultAuthor", () => {
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor="Ada"
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    expect(screen.getByPlaceholderText("Your name")).toHaveValue("Ada");
  });

  it("keeps the submit button disabled until a body is typed", async () => {
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor="Ada"
        onSubmit={() => {}}
        onCancel={() => {}}
      />
    );
    const submit = screen.getByRole("button", { name: "Comment" });
    expect(submit).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText("Add a comment…"), "hi");
    expect(submit).toBeEnabled();
  });

  it("submits the trimmed author and body", async () => {
    const onSubmit = vi.fn();
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor=""
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    await userEvent.type(screen.getByPlaceholderText("Your name"), "  Grace  ");
    await userEvent.type(
      screen.getByPlaceholderText("Add a comment…"),
      "  a note  "
    );
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(onSubmit).toHaveBeenCalledWith("Grace", "a note");
  });

  it("defaults an empty author to Anonymous on submit", async () => {
    const onSubmit = vi.fn();
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor=""
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    await userEvent.type(screen.getByPlaceholderText("Add a comment…"), "note");
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(onSubmit).toHaveBeenCalledWith("Anonymous", "note");
  });

  it("submits on Cmd/Ctrl+Enter from the body field", async () => {
    const onSubmit = vi.fn();
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor="Ada"
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    const body = screen.getByPlaceholderText("Add a comment…");
    await userEvent.type(body, "quick note");
    await userEvent.type(body, "{Meta>}{Enter}{/Meta}");
    expect(onSubmit).toHaveBeenCalledWith("Ada", "quick note");
  });

  it("does not submit a whitespace-only body via keyboard", async () => {
    const onSubmit = vi.fn();
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor="Ada"
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    );
    // The submit button is disabled while the body is blank, so drive submit()
    // directly through the ⌘/Ctrl+Enter path to exercise its own guard.
    const body = screen.getByPlaceholderText("Add a comment…");
    await userEvent.type(body, "   ");
    await userEvent.type(body, "{Meta>}{Enter}{/Meta}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cancels via the Cancel button", async () => {
    const onCancel = vi.fn();
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor="Ada"
        onSubmit={() => {}}
        onCancel={onCancel}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("cancels on Escape", async () => {
    const onCancel = vi.fn();
    render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor="Ada"
        onSubmit={() => {}}
        onCancel={onCancel}
      />
    );
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalled();
  });

  it("cancels when the click-away backdrop is pressed", async () => {
    const onCancel = vi.fn();
    const { container } = render(
      <CommentPopover
        anchor={anchor}
        defaultAuthor="Ada"
        onSubmit={() => {}}
        onCancel={onCancel}
      />
    );
    const backdrop = container.querySelector(".fixed.inset-0") as HTMLElement;
    await userEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalled();
  });
});
