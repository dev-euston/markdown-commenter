"use client";

/**
 * Renders a fenced ```mermaid block as a client-side SVG diagram, with a
 * per-instance toggle to reveal the raw source.
 *
 * Notes:
 * - The diagram/source toggle is ephemeral per-block UI state. It is never
 *   written to the comment file or the Markdown — it only affects what this
 *   component paints.
 * - Commenting is available only in *source* view: the raw source is rendered
 *   as real selectable text so it participates in the existing text-node walk
 *   used by applyHighlights / findSelectionQuote (no new anchoring model).
 * - When a block carries comments (a comment's quote appears in this block's
 *   source), the *diagram* view gets a visual highlight so reviewers can see
 *   which diagrams have discussion, and clicking it activates that comment.
 */

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import type { Comment } from "@/lib/comments";
import { renderMermaid } from "@/lib/mermaid";

export interface MermaidContextValue {
  comments: Comment[];
  activeId: string | null;
  setActiveId: (id: string) => void;
  onToggle: () => void;
}

export const MermaidContext = createContext<MermaidContextValue>({
  comments: [],
  activeId: null,
  setActiveId: () => {},
  onToggle: () => {},
});

export default function MermaidBlock({ source }: { source: string }) {
  const { comments, activeId, setActiveId, onToggle } =
    useContext(MermaidContext);

  // Ephemeral per-block view state. Default = diagram; never persisted.
  const [showSource, setShowSource] = useState(false);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A stable, valid element id derived from React's useId (which contains ':').
  const rawId = useId();
  const diagramId = `mermaid-${rawId.replace(/[^a-zA-Z0-9-_]/g, "")}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    // Reset any prior error, then (re)render this block's source. Synchronous
    // setState here is intentional — we're syncing to the async mermaid render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    renderMermaid(diagramId, source)
      .then((out) => {
        if (!cancelled) setSvg(out);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      });
    return () => {
      cancelled = true;
    };
    // diagramId is stable for the component's lifetime; keyed on source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const toggle = () => {
    setShowSource((v) => !v);
    onToggle();
  };

  // Comments anchored to this block: conservative substring heuristic.
  const commented = comments.filter((c) => c.quote && source.includes(c.quote));
  const firstCommentedId = commented[0]?.id ?? null;
  const isActive =
    firstCommentedId !== null &&
    commented.some((c) => c.id === activeId);

  return (
    <div className="md-mermaid">
      <button
        type="button"
        onClick={toggle}
        aria-label={showSource ? "Show diagram" : "Show source"}
        className="md-mermaid-toggle"
      >
        {showSource ? "Show diagram" : "Show source"}
      </button>

      {showSource ? (
        <pre>
          <code>{source}</code>
        </pre>
      ) : error ? (
        <pre>
          <code>{source}</code>
        </pre>
      ) : commented.length > 0 ? (
        <div
          className={`md-mermaid-diagram has-comment${
            isActive ? " is-active" : ""
          }`}
          data-comment-id={firstCommentedId ?? undefined}
          onClick={() => {
            if (firstCommentedId) setActiveId(firstCommentedId);
          }}
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
      ) : (
        <div
          className="md-mermaid-diagram"
          dangerouslySetInnerHTML={{ __html: svg ?? "" }}
        />
      )}
    </div>
  );
}
