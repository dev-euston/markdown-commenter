"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  type Comment,
  emptyCommentFile,
  newCommentId,
  parseCommentFile,
  serializeComments,
} from "@/lib/comments";
import {
  applyHighlights,
  clearHighlights,
  findSelectionQuote,
} from "@/lib/highlight";
import CommentSidebar from "@/components/CommentSidebar";
import CommentPopover, {
  type PendingAnchor,
} from "@/components/CommentPopover";

export default function Home() {
  const [markdown, setMarkdown] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAnchor | null>(null);
  const [lastAuthor, setLastAuthor] = useState<string>("");
  const [commentFileName, setCommentFileName] = useState<string>("");

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setMarkdown(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  const loadCommentFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCommentFile(
          typeof reader.result === "string" ? reader.result : ""
        );
        setComments(parsed.comments);
        setCommentFileName(file.name);
        setActiveId(null);
      } catch (err) {
        alert(
          `Could not load comments: ${
            err instanceof Error ? err.message : "unknown error"
          }`
        );
      }
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  const clear = useCallback(() => {
    setMarkdown("");
    setFileName("");
    setComments([]);
    setCommentFileName("");
    setActiveId(null);
    setPending(null);
    if (inputRef.current) inputRef.current.value = "";
    if (commentInputRef.current) commentInputRef.current.value = "";
  }, []);

  // Re-apply highlights whenever the document or comments change.
  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;
    applyHighlights(container, comments, (id) => setActiveId(id));
    return () => {
      clearHighlights(container);
    };
  }, [markdown, comments]);

  // Reflect the active comment onto its highlight marks.
  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;
    const marks =
      container.querySelectorAll<HTMLElement>("mark.md-comment-highlight");
    marks.forEach((m) => {
      m.classList.toggle(
        "is-active",
        m.dataset.commentId === activeId && activeId !== null
      );
    });
  }, [activeId, comments, markdown]);

  // Capture a text selection inside the document to start a new comment.
  const onMouseUp = useCallback(() => {
    const container = articleRef.current;
    if (!container) return;
    const selection = window.getSelection();
    const anchor = findSelectionQuote(container, selection);
    if (!anchor) return;

    const range = selection!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPending({
      quote: anchor.quote,
      occurrence: anchor.occurrence,
      x: rect.left,
      y: rect.bottom,
    });
  }, []);

  const addComment = useCallback(
    (author: string, body: string) => {
      if (!pending) return;
      const comment: Comment = {
        id: newCommentId(),
        quote: pending.quote,
        occurrence: pending.occurrence,
        author,
        body,
        createdAt: new Date().toISOString(),
        resolved: false,
      };
      setComments((prev) => [...prev, comment]);
      setLastAuthor(author);
      setActiveId(comment.id);
      setPending(null);
      window.getSelection()?.removeAllRanges();
    },
    [pending]
  );

  const selectComment = useCallback((id: string) => {
    setActiveId(id);
    const container = articleRef.current;
    const mark = container?.querySelector<HTMLElement>(
      `mark.md-comment-highlight[data-comment-id="${id}"]`
    );
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      mark.classList.add("flash");
      window.setTimeout(() => mark.classList.remove("flash"), 1000);
    }
  }, []);

  const toggleResolved = useCallback((id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c))
    );
  }, []);

  const deleteComment = useCallback(
    (id: string) => {
      setComments((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  const downloadComments = useCallback(() => {
    const json = serializeComments(comments, fileName || undefined);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = commentFileName || "comments.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [comments, fileName, commentFileName]);

  const startNewComments = useCallback(() => {
    const empty = emptyCommentFile(fileName || undefined);
    setComments(empty.comments);
    setCommentFileName("comments.json");
  }, [fileName]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Markdown Commenter
          </h1>
          {fileName && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {fileName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Open .md file
          </button>
          {markdown && (
            <>
              <button
                onClick={() => commentInputRef.current?.click()}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Open comments (.json)
              </button>
              <button
                onClick={startNewComments}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                New comments
              </button>
              <button
                onClick={downloadComments}
                disabled={comments.length === 0}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Download comments
              </button>
              <button
                onClick={clear}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Clear
              </button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadFile(file);
            }}
          />
          <input
            ref={commentInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadCommentFile(file);
            }}
          />
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {markdown ? (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <article
                ref={articleRef}
                onMouseUp={onMouseUp}
                className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="md-preview">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {markdown}
                  </ReactMarkdown>
                </div>
              </article>
            </div>
            <CommentSidebar
              comments={comments}
              activeId={activeId}
              onSelect={selectComment}
              onToggleResolved={toggleResolved}
              onDelete={deleteComment}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col p-6">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`mx-auto flex w-full max-w-3xl flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
                dragging
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              }`}
            >
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Drop a Markdown file here
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                or click to browse (.md, .markdown)
              </p>
            </div>
          </div>
        )}
      </main>

      {pending && (
        <CommentPopover
          anchor={pending}
          defaultAuthor={lastAuthor}
          onSubmit={addComment}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
