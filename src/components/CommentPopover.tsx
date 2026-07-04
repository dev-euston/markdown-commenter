"use client";

import { useEffect, useRef, useState } from "react";

export interface PendingAnchor {
  quote: string;
  occurrence: number;
  /** Viewport-relative position to anchor the popover near. */
  x: number;
  y: number;
}

interface CommentPopoverProps {
  anchor: PendingAnchor;
  /** Default author, remembered from the previous comment. */
  defaultAuthor: string;
  onSubmit: (author: string, body: string) => void;
  onCancel: () => void;
}

const POPOVER_WIDTH = 288; // matches w-72

export default function CommentPopover({
  anchor,
  defaultAuthor,
  onSubmit,
  onCancel,
}: CommentPopoverProps) {
  const [author, setAuthor] = useState(defaultAuthor);
  const [body, setBody] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the body (or author if none remembered) once mounted.
    if (defaultAuthor) bodyRef.current?.focus();
  }, [defaultAuthor]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Keep the popover within the viewport horizontally. The `typeof window`
  // guard is for SSR safety; this component only ever mounts client-side.
  const viewportWidth =
    /* v8 ignore next */
    typeof window !== "undefined" ? window.innerWidth : POPOVER_WIDTH * 2;
  const left = Math.min(
    Math.max(8, anchor.x),
    viewportWidth - POPOVER_WIDTH - 8
  );

  function submit() {
    if (!body.trim()) return;
    onSubmit(author.trim() || "Anonymous", body.trim());
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onMouseDown={onCancel} />
      <div
        ref={rootRef}
        className="fixed z-50 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        style={{ left, top: anchor.y + 8 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <blockquote className="mb-2 max-h-16 overflow-y-auto border-l-2 border-amber-300 pl-2 text-[11px] italic text-zinc-500 dark:border-amber-500/50 dark:text-zinc-400">
          “{anchor.quote}”
        </blockquote>

        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Your name"
          className="mb-2 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />

        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Add a comment…"
          rows={3}
          className="w-full resize-none rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />

        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!body.trim()}
            className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Comment
          </button>
        </div>
      </div>
    </>
  );
}
