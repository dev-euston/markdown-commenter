import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Comment } from "@/lib/comments";
import CommentSidebar from "./CommentSidebar";

function comment(overrides: Partial<Comment>): Comment {
  return {
    id: "c1",
    quote: "the quote",
    occurrence: 1,
    author: "Ada Lovelace",
    body: "a comment body",
    createdAt: "2024-01-15T00:00:00.000Z",
    resolved: false,
    ...overrides,
  };
}

const noop = () => {};

describe("CommentSidebar", () => {
  it("shows an empty state when there are no comments", () => {
    render(
      <CommentSidebar
        comments={[]}
        activeId={null}
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText(/No comments yet/i)).toBeInTheDocument();
  });

  it("renders the comment count and each comment's content", () => {
    render(
      <CommentSidebar
        comments={[comment({}), comment({ id: "c2", author: "Grace Hopper" })]}
        activeId={null}
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getAllByText("a comment body")).toHaveLength(2);
  });

  it("derives avatar initials from first and last name", () => {
    render(
      <CommentSidebar
        comments={[comment({ author: "Ada Lovelace" })]}
        activeId={null}
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("uses the first two letters for a single-word author", () => {
    render(
      <CommentSidebar
        comments={[comment({ author: "madonna" })]}
        activeId={null}
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("MA")).toBeInTheDocument();
  });

  it("falls back to '?' for a blank author", () => {
    render(
      <CommentSidebar
        comments={[comment({ author: "   " })]}
        activeId={null}
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("hides the date for an epoch-zero timestamp", () => {
    render(
      <CommentSidebar
        comments={[comment({ createdAt: new Date(0).toISOString() })]}
        activeId={null}
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
  });

  it("calls onSelect when a comment card is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <CommentSidebar
        comments={[comment({})]}
        activeId={null}
        onSelect={onSelect}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /a comment body/i }));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("selects a comment via keyboard (Enter / Space)", async () => {
    const onSelect = vi.fn();
    render(
      <CommentSidebar
        comments={[comment({})]}
        activeId={null}
        onSelect={onSelect}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    const card = screen.getByRole("button", { name: /a comment body/i });
    card.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("toggles resolved without triggering select", async () => {
    const onSelect = vi.fn();
    const onToggleResolved = vi.fn();
    render(
      <CommentSidebar
        comments={[comment({})]}
        activeId={null}
        onSelect={onSelect}
        onToggleResolved={onToggleResolved}
        onDelete={noop}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(onToggleResolved).toHaveBeenCalledWith("c1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows 'Reopen' for a resolved comment", () => {
    render(
      <CommentSidebar
        comments={[comment({ resolved: true })]}
        activeId={null}
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });

  it("deletes without triggering select", async () => {
    const onSelect = vi.fn();
    const onDelete = vi.fn();
    render(
      <CommentSidebar
        comments={[comment({})]}
        activeId={null}
        onSelect={onSelect}
        onToggleResolved={noop}
        onDelete={onDelete}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("c1");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("marks the active comment's quote", () => {
    render(
      <CommentSidebar
        comments={[comment({})]}
        activeId="c1"
        onSelect={noop}
        onToggleResolved={noop}
        onDelete={noop}
      />
    );
    const card = screen.getByRole("button", { name: /a comment body/i });
    expect(within(card).getByText(/the quote/)).toBeInTheDocument();
  });
});
