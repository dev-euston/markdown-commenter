/**
 * DOM-based highlighter for the rendered Markdown preview.
 *
 * Highlights must span the *rendered* DOM (a quote can cross multiple inline
 * elements), not the raw markdown. We walk the container's text nodes in
 * document order, concatenate them into one string with an index map back to
 * each text node + offset, locate the requested quote occurrence, then wrap
 * the covered range with <mark> elements — one per text-node segment.
 */

import type { Comment } from "./comments";

export const HIGHLIGHT_TAG = "MARK";
export const HIGHLIGHT_CLASS = "md-comment-highlight";
const HIGHLIGHT_SELECTOR = `${HIGHLIGHT_TAG.toLowerCase()}.${HIGHLIGHT_CLASS}`;

interface TextPiece {
  node: Text;
  /** Start index of this node's text within the concatenated document string. */
  start: number;
}

/** Walk visible text nodes, skipping any inside existing highlight marks. */
function collectTextPieces(container: HTMLElement): {
  pieces: TextPiece[];
  text: string;
} {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      // Ignore empty text nodes and anything already inside a highlight.
      if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (parent?.closest(HIGHLIGHT_SELECTOR)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const pieces: TextPiece[] = [];
  let text = "";
  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    pieces.push({ node, start: text.length });
    text += node.nodeValue ?? "";
    current = walker.nextNode();
  }
  return { pieces, text };
}

/** Find the character index of the `occurrence`-th (1-based) match of `quote`. */
function nthIndexOf(haystack: string, quote: string, occurrence: number): number {
  let from = 0;
  let found = -1;
  for (let n = 0; n < occurrence; n++) {
    found = haystack.indexOf(quote, from);
    if (found === -1) return -1;
    from = found + quote.length;
  }
  return found;
}

/**
 * Wrap the character range [start, end) of the concatenated document text
 * with <mark> elements, splitting across text-node boundaries as needed.
 */
function wrapRange(
  pieces: TextPiece[],
  start: number,
  end: number,
  comment: Comment,
  onClick: (id: string) => void
): void {
  for (const piece of pieces) {
    const text = piece.node.nodeValue ?? "";
    const pieceStart = piece.start;
    const pieceEnd = pieceStart + text.length;

    // Skip pieces entirely outside the range.
    if (pieceEnd <= start || pieceStart >= end) continue;

    const localStart = Math.max(0, start - pieceStart);
    const localEnd = Math.min(text.length, end - pieceStart);
    if (localEnd <= localStart) continue;

    const range = document.createRange();
    range.setStart(piece.node, localStart);
    range.setEnd(piece.node, localEnd);

    const mark = document.createElement("mark");
    mark.className = HIGHLIGHT_CLASS;
    mark.dataset.commentId = comment.id;
    if (comment.resolved) mark.dataset.resolved = "true";
    mark.addEventListener("click", (e) => {
      e.stopPropagation();
      onClick(comment.id);
    });

    try {
      range.surroundContents(mark);
    } catch {
      // surroundContents can throw if the range partially selects a
      // non-text node; fall back to extract + insert.
      const contents = range.extractContents();
      mark.appendChild(contents);
      range.insertNode(mark);
    } finally {
      range.detach?.();
    }
  }
}

/**
 * Remove all highlight <mark> wrappers from the container, restoring the
 * original text nodes. Safe to call when there are none.
 */
export function clearHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll<HTMLElement>(HIGHLIGHT_SELECTOR);
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  });
}

/**
 * Apply highlights for every comment. Clears existing highlights first.
 * Because wrapping mutates the DOM (and thus the index map), we re-collect
 * text pieces for each comment.
 */
export function applyHighlights(
  container: HTMLElement,
  comments: Comment[],
  onClick: (id: string) => void
): void {
  clearHighlights(container);

  for (const comment of comments) {
    if (!comment.quote) continue;
    const { pieces, text } = collectTextPieces(container);
    const start = nthIndexOf(text, comment.quote, comment.occurrence);
    if (start === -1) continue; // quote no longer present — skip silently
    wrapRange(pieces, start, start + comment.quote.length, comment, onClick);
  }
}

/**
 * Given the current text selection inside the container, derive the anchor
 * for a new comment: the selected quote and which occurrence of it this is.
 * Returns null when the selection is empty or lies outside the container.
 */
export function findSelectionQuote(
  container: HTMLElement,
  selection: Selection | null
): { quote: string; occurrence: number } | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }

  const quote = selection.toString();
  if (!quote.trim()) return null;

  // Compute the occurrence index by counting matches before the selection.
  const { pieces, text } = collectTextPieces(container);
  const selStart = charIndexOfPoint(
    pieces,
    range.startContainer,
    range.startOffset
  );
  if (selStart === -1) return null;

  let occurrence = 0;
  let from = 0;
  while (from <= selStart) {
    const idx = text.indexOf(quote, from);
    if (idx === -1) break;
    occurrence++;
    if (idx === selStart) break;
    from = idx + 1;
  }

  return { quote, occurrence: Math.max(1, occurrence) };
}

/** Map a (node, offset) DOM point to an index in the concatenated text. */
function charIndexOfPoint(
  pieces: TextPiece[],
  node: Node,
  offset: number
): number {
  // If the point is a text node we tracked, use it directly.
  for (const piece of pieces) {
    if (piece.node === node) return piece.start + offset;
  }
  // Otherwise, find the first tracked text node at/after the point.
  for (const piece of pieces) {
    const pos = node.compareDocumentPosition(piece.node);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return piece.start;
  }
  return -1;
}
