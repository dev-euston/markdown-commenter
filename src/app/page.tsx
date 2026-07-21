"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { buildZip, extractZip, zipFileNameFor } from "@/lib/zip";
import { BUNDLED_DOCS, type BundledDoc, loadBundledDoc } from "@/lib/docs";
import {
  fetchGitLabRawFile,
  fileNameFromPath,
  parseGitLabBlobUrl,
} from "@/lib/gitlab";
import CommentSidebar from "@/components/CommentSidebar";
import CommentPopover, {
  type PendingAnchor,
} from "@/components/CommentPopover";
import OnboardingTour from "@/components/OnboardingTour";
import MermaidBlock, { MermaidContext } from "@/components/MermaidBlock";
import { TOUR_STEPS, hasSeenTour, markTourSeen } from "@/lib/tour";

// Defined at module scope so ReactMarkdown doesn't remount the tree on every
// render (which would discard each MermaidBlock's per-block toggle state).
// MermaidBlock reads all dynamic data from MermaidContext, so this object is
// stable and never needs to close over page state.
const markdownComponents = {
  // Skip images whose src resolves empty (e.g. `![alt]()`). React warns that an
  // empty `src` makes the browser refetch the whole page.
  img(props: React.ComponentProps<"img">) {
    if (!props.src) return null;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ""} />;
  },
  code({
    className,
    children,
    ...props
  }: React.ComponentProps<"code"> & { node?: unknown }) {
    if (/language-mermaid/.test(className ?? "")) {
      return <MermaidBlock source={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre({
    children,
    node,
    ...props
  }: React.ComponentProps<"pre"> & { node?: unknown }) {
    // Inspect the hast node's first child (the <code>) for a mermaid class.
    const firstChild = (
      node as { children?: Array<{ properties?: { className?: unknown } }> }
    )?.children?.[0];
    const childClass = firstChild?.properties?.className;
    const classes = Array.isArray(childClass)
      ? childClass
      : typeof childClass === "string"
        ? [childClass]
        : [];
    // Unwrap mermaid blocks so the MermaidBlock is not nested inside a <pre>.
    if (classes.some((c) => String(c).includes("language-mermaid"))) {
      return <>{children}</>;
    }
    return <pre {...props}>{children}</pre>;
  },
};

export default function Home() {
  const [markdown, setMarkdown] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAnchor | null>(null);
  // A comment whose highlight mark isn't yet in the DOM (its mermaid block is
  // showing the diagram): once the block flips to source and applyHighlights
  // re-runs, the deferred focus effect scrolls/flashes it.
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  // Instructs the owning MermaidBlock to switch to source view. The nonce lets
  // re-selecting the same comment re-fire the request after a manual revert.
  const [sourceViewRequest, setSourceViewRequest] = useState<{
    commentId: string;
    nonce: number;
  } | null>(null);
  const [lastAuthor, setLastAuthor] = useState<string>("");
  const [commentFileName, setCommentFileName] = useState<string>("");
  const [showTour, setShowTour] = useState(false);
  const [docsMenuOpen, setDocsMenuOpen] = useState(false);

  // GitLab load controls. Both the URL and the token live only in React state
  // for the session — never written to localStorage/sessionStorage, never
  // logged, and the token is cleared after a successful load.
  const [gitlabUrl, setGitlabUrl] = useState("");
  const [gitlabToken, setGitlabToken] = useState("");
  const [gitlabPanelOpen, setGitlabPanelOpen] = useState(false);
  const [gitlabLoading, setGitlabLoading] = useState(false);

  // Bumped whenever a MermaidBlock toggles between diagram and source views.
  // Used only to re-run the DOM highlighter over newly-rendered source text;
  // toggle state itself is never persisted.
  const [diagramViewVersion, setDiagramViewVersion] = useState(0);
  const onDiagramToggle = useCallback(
    () => setDiagramViewVersion((v) => v + 1),
    []
  );

  // Auto-launch the tour on a user's first visit only. Done in an effect (not a
  // lazy initializer) so the server render — where localStorage is unavailable —
  // matches the client's first paint and avoids a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!hasSeenTour()) setShowTour(true);
  }, []);

  const closeTour = useCallback(() => {
    markTourSeen();
    setShowTour(false);
  }, []);

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setMarkdown(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
    };
    reader.readAsText(file);
  }, []);

  // Load a bundled doc into the viewer, reusing the file-load render path.
  // Mirrors loadFile: sets markdown + fileName, leaves comments untouched.
  const openDoc = useCallback(async (doc: BundledDoc) => {
    try {
      const text = await loadBundledDoc(doc);
      setMarkdown(text);
      setFileName(doc.fileName);
    } catch (err) {
      alert(
        `Could not load ${doc.fileName}: ${
          err instanceof Error ? err.message : "unknown error"
        }`
      );
    }
  }, []);

  // Load a bundled doc specified via ?doc=<key> on initial page load.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docKey = params.get("doc");
    if (!docKey) return;
    const doc = BUNDLED_DOCS.find((d) => d.key === docKey);
    if (doc) openDoc(doc);
  }, [openDoc]);

  // Load a Markdown file directly from the self-hosted GitLab, reusing the same
  // render path as loadFile/openDoc (sets markdown + fileName only; leaves
  // comments untouched). The token is passed only to the GitLab origin and is
  // cleared from state after a successful load. Never logs the token/response.
  const loadFromGitLab = useCallback(async () => {
    let ref;
    try {
      ref = parseGitLabBlobUrl(gitlabUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Invalid GitLab URL.");
      return;
    }

    setGitlabLoading(true);
    try {
      const text = await fetchGitLabRawFile(ref, gitlabToken);
      setMarkdown(text);
      setFileName(fileNameFromPath(ref.filePath));
      setGitlabPanelOpen(false);
      setGitlabToken("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not load from GitLab.");
    } finally {
      setGitlabLoading(false);
    }
  }, [gitlabUrl, gitlabToken]);

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

  const loadZipFile = useCallback((file: File) => {
    file
      .arrayBuffer()
      .then((buf) => {
        // Validate extraction and comments before touching any state so an
        // invalid archive aborts without a partial load.
        const { markdown, markdownName, commentsJson, commentsName } =
          extractZip(new Uint8Array(buf));
        const parsed = parseCommentFile(commentsJson);
        setMarkdown(markdown);
        setFileName(markdownName);
        setComments(parsed.comments);
        setCommentFileName(commentsName);
        setActiveId(null);
      })
      .catch((err) => {
        alert(
          `Could not load zip: ${
            err instanceof Error ? err.message : "unknown error"
          }`
        );
      });
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
    if (zipInputRef.current) zipInputRef.current.value = "";
  }, []);

  // Scroll to and flash the highlight mark for `id`. Returns whether a mark was
  // found — false means its owning mermaid block is still showing the diagram.
  const focusMark = useCallback((id: string): boolean => {
    const container = articleRef.current;
    const mark = container?.querySelector<HTMLElement>(
      `mark.md-comment-highlight[data-comment-id="${id}"]`
    );
    if (!mark) return false;
    mark.scrollIntoView({ behavior: "smooth", block: "center" });
    mark.classList.add("flash");
    window.setTimeout(() => mark.classList.remove("flash"), 1000);
    return true;
  }, []);

  // Re-apply highlights whenever the document or comments change.
  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;
    applyHighlights(container, comments, (id) => setActiveId(id));
    return () => {
      clearHighlights(container);
    };
  }, [markdown, comments, diagramViewVersion]);

  // Deferred focus: once a mermaid block has flipped to source view (bumping
  // diagramViewVersion) and applyHighlights has re-created its mark, scroll to
  // and flash it. Placed after the applyHighlights effect so it runs against
  // the freshly-applied highlights within the same commit.
  useEffect(() => {
    if (!pendingFocusId) return;
    if (focusMark(pendingFocusId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingFocusId(null);
    }
  }, [pendingFocusId, diagramViewVersion, comments, markdown, focusMark]);

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
  }, [activeId, comments, markdown, diagramViewVersion]);

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

  const selectComment = useCallback(
    (id: string) => {
      setActiveId(id);
      // A mark already exists for normal document comments, and for mermaid
      // blocks already showing source — focus it immediately.
      if (focusMark(id)) return;
      // Otherwise the comment is likely anchored to a mermaid block currently
      // showing its diagram: ask the owning block to flip to source view, then
      // defer the scroll/flash until its mark has rendered.
      setPendingFocusId(id);
      setSourceViewRequest((prev) => ({
        commentId: id,
        nonce: (prev?.nonce ?? 0) + 1,
      }));
    },
    [focusMark]
  );

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

  const downloadZip = useCallback(() => {
    const json = serializeComments(comments, fileName || undefined);
    const bytes = buildZip({
      markdown,
      markdownName: fileName,
      commentsJson: json,
      commentsName: commentFileName || "comments.json",
    });
    const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = zipFileNameFor(fileName);
    a.click();
    URL.revokeObjectURL(url);
  }, [comments, fileName, commentFileName, markdown]);

  const startNewComments = useCallback(() => {
    if (
      comments.length > 0 &&
      !window.confirm(
        "Start a new comment set? This will discard the current comments."
      )
    ) {
      return;
    }
    const empty = emptyCommentFile(fileName || undefined);
    setComments(empty.comments);
    setCommentFileName("comments.json");
  }, [fileName, comments.length]);

  const mermaidCtx = useMemo(
    () => ({
      comments,
      activeId,
      setActiveId,
      onToggle: onDiagramToggle,
      sourceViewRequest,
    }),
    [comments, activeId, onDiagramToggle, sourceViewRequest]
  );

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
          <div className="flex items-center gap-2" data-tour="load">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Open .md file
            </button>
            <button
              onClick={() => zipInputRef.current?.click()}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Open .zip
            </button>
            <div className="relative">
              <button
                onClick={() => setGitlabPanelOpen((open) => !open)}
                aria-haspopup="dialog"
                aria-expanded={gitlabPanelOpen}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Load from GitLab
              </button>
              {gitlabPanelOpen && (
                <div
                  role="dialog"
                  aria-label="Load from GitLab"
                  className="absolute right-0 z-10 mt-1 w-80 rounded-md border border-zinc-300 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    File URL
                    <input
                      type="text"
                      value={gitlabUrl}
                      onChange={(e) => setGitlabUrl(e.target.value)}
                      placeholder="https://sgts.gitlab-dedicated.com/group/project/-/blob/main/README.md"
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </label>
                  <label className="mt-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Access token
                    <input
                      type="password"
                      autoComplete="off"
                      value={gitlabToken}
                      onChange={(e) => setGitlabToken(e.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </label>
                  <button
                    onClick={loadFromGitLab}
                    disabled={
                      gitlabLoading || !gitlabUrl.trim() || !gitlabToken.trim()
                    }
                    className="mt-3 w-full rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                  >
                    {gitlabLoading ? "Loading…" : "Load"}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setDocsMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={docsMenuOpen}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Docs
            </button>
            {docsMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-1 min-w-40 rounded-md border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                {BUNDLED_DOCS.map((doc) => (
                  <button
                    key={doc.key}
                    role="menuitem"
                    onClick={() => {
                      setDocsMenuOpen(false);
                      openDoc(doc);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {doc.label}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              <div className="flex items-center gap-2" data-tour="download">
                <button
                  onClick={downloadComments}
                  disabled={comments.length === 0}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Download comments
                </button>
                <button
                  onClick={downloadZip}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Download .zip
                </button>
              </div>
              <button
                onClick={clear}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Clear
              </button>
            </>
          )}
          <button
            onClick={() => setShowTour(true)}
            aria-label="Help"
            title="Show the tour"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ? Help
          </button>
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
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadZipFile(file);
              e.target.value = "";
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
                data-tour="document"
                onMouseUp={onMouseUp}
                className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="md-preview">
                  <MermaidContext.Provider value={mermaidCtx}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {markdown}
                    </ReactMarkdown>
                  </MermaidContext.Provider>
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
              data-tour="document"
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

      {showTour && (
        <OnboardingTour steps={TOUR_STEPS} onClose={closeTour} />
      )}
    </div>
  );
}
