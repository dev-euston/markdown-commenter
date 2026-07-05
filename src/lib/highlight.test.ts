import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Comment } from "./comments";
import {
  HIGHLIGHT_CLASS,
  applyHighlights,
  clearHighlights,
  findSelectionQuote,
} from "./highlight";

function comment(overrides: Partial<Comment>): Comment {
  return {
    id: "c1",
    quote: "",
    occurrence: 1,
    author: "A",
    body: "",
    createdAt: "1970-01-01T00:00:00.000Z",
    resolved: false,
    ...overrides,
  };
}

function marks(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`)
  );
}

describe("applyHighlights", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("wraps the requested quote in a mark carrying the comment id", () => {
    container.innerHTML = "<p>The quick brown fox</p>";
    applyHighlights(container, [comment({ quote: "quick brown" })], () => {});

    const found = marks(container);
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe("quick brown");
    expect(found[0].dataset.commentId).toBe("c1");
  });

  it("targets the requested occurrence", () => {
    container.innerHTML = "<p>ab ab ab</p>";
    applyHighlights(
      container,
      [comment({ quote: "ab", occurrence: 2 })],
      () => {}
    );

    const found = marks(container);
    expect(found).toHaveLength(1);
    // The second "ab" begins at index 3 of "ab ab ab".
    expect(container.textContent).toBe("ab ab ab");
    expect(found[0].previousSibling?.textContent).toBe("ab ");
  });

  it("spans a quote crossing multiple inline elements", () => {
    container.innerHTML = "<p>a <strong>bold</strong> word</p>";
    applyHighlights(
      container,
      [comment({ quote: "a bold word" })],
      () => {}
    );

    const found = marks(container);
    // One mark per text-node segment: "a ", "bold", " word".
    expect(found).toHaveLength(3);
    expect(found.map((m) => m.textContent).join("")).toBe("a bold word");
  });

  it("skips comments whose quote is absent", () => {
    container.innerHTML = "<p>hello world</p>";
    applyHighlights(container, [comment({ quote: "missing" })], () => {});
    expect(marks(container)).toHaveLength(0);
  });

  it("skips comments with an empty quote", () => {
    container.innerHTML = "<p>hello</p>";
    applyHighlights(container, [comment({ quote: "" })], () => {});
    expect(marks(container)).toHaveLength(0);
  });

  it("marks resolved comments with a data attribute", () => {
    container.innerHTML = "<p>done here</p>";
    applyHighlights(
      container,
      [comment({ quote: "done", resolved: true })],
      () => {}
    );
    expect(marks(container)[0].dataset.resolved).toBe("true");
  });

  it("invokes onClick with the comment id when a mark is clicked", () => {
    container.innerHTML = "<p>click me</p>";
    const onClick = vi.fn();
    applyHighlights(container, [comment({ quote: "click", id: "z9" })], onClick);

    marks(container)[0].dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    expect(onClick).toHaveBeenCalledWith("z9");
  });

  it("re-applying clears previous highlights first", () => {
    container.innerHTML = "<p>alpha beta</p>";
    applyHighlights(container, [comment({ quote: "alpha" })], () => {});
    applyHighlights(container, [comment({ quote: "beta" })], () => {});

    const found = marks(container);
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe("beta");
  });

  it("handles multiple comments in one pass", () => {
    container.innerHTML = "<p>one two three</p>";
    applyHighlights(
      container,
      [
        comment({ id: "a", quote: "one" }),
        comment({ id: "b", quote: "three" }),
      ],
      () => {}
    );
    expect(marks(container).map((m) => m.dataset.commentId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("clearHighlights", () => {
  it("removes marks and restores the original text", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>keep this text</p>";
    applyHighlights(container, [comment({ quote: "this" })], () => {});
    expect(container.querySelector("mark")).not.toBeNull();

    clearHighlights(container);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("keep this text");
    // Text nodes should be normalized back into a single node.
    expect(container.querySelector("p")?.childNodes).toHaveLength(1);
  });

  it("is a no-op when there are no highlights", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>nothing</p>";
    expect(() => clearHighlights(container)).not.toThrow();
    expect(container.textContent).toBe("nothing");
  });
});

describe("findSelectionQuote", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  function selectText(node: Text, start: number, end: number): Selection {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
  }

  it("returns null for a null selection", () => {
    expect(findSelectionQuote(container, null)).toBeNull();
  });

  it("returns null for a collapsed selection", () => {
    container.innerHTML = "<p>text</p>";
    const textNode = container.querySelector("p")!.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(findSelectionQuote(container, selection)).toBeNull();
  });

  it("returns null when the selection is outside the container", () => {
    container.innerHTML = "<p>inside</p>";
    const outside = document.createElement("p");
    outside.textContent = "outside";
    document.body.appendChild(outside);

    const selection = selectText(outside.firstChild as Text, 0, 3);
    expect(findSelectionQuote(container, selection)).toBeNull();
  });

  it("returns null for a whitespace-only selection", () => {
    container.innerHTML = "<p>a   b</p>";
    const textNode = container.querySelector("p")!.firstChild as Text;
    const selection = selectText(textNode, 1, 4);
    expect(findSelectionQuote(container, selection)).toBeNull();
  });

  it("derives the quote and first occurrence", () => {
    container.innerHTML = "<p>the quick fox</p>";
    const textNode = container.querySelector("p")!.firstChild as Text;
    const selection = selectText(textNode, 4, 9); // "quick"

    expect(findSelectionQuote(container, selection)).toEqual({
      quote: "quick",
      occurrence: 1,
    });
  });

  it("counts the occurrence index for repeated phrases", () => {
    container.innerHTML = "<p>ab ab ab</p>";
    const textNode = container.querySelector("p")!.firstChild as Text;
    const selection = selectText(textNode, 6, 8); // third "ab"

    expect(findSelectionQuote(container, selection)).toEqual({
      quote: "ab",
      occurrence: 3,
    });
  });

  it("resolves a selection that starts on an element boundary", () => {
    container.innerHTML = "<p><strong>bold</strong> tail</p>";
    const paragraph = container.querySelector("p")!;
    const strong = paragraph.querySelector("strong")!;

    // Start the range on the <p> element (before <strong>), not a text node,
    // so the point maps to the following tracked text node.
    const range = document.createRange();
    range.setStart(paragraph, 0);
    range.setEnd(strong.firstChild as Text, 4);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(findSelectionQuote(container, selection)).toEqual({
      quote: "bold",
      occurrence: 1,
    });
  });
});
