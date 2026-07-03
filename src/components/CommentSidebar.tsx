"use client";

import type { Comment } from "@/lib/comments";

interface CommentSidebarProps {
  comments: Comment[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleResolved: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CommentSidebar({
  comments,
  activeId,
  onSelect,
  onToggleResolved,
  onDelete,
}: CommentSidebarProps) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Comments
        </h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {comments.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {comments.length === 0 ? (
          <p className="px-1 py-8 text-center text-xs text-zinc-500 dark:text-zinc-500">
            No comments yet. Select text in the document to add one.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {comments.map((c) => {
              const isActive = c.id === activeId;
              return (
                <li key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(c.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(c.id);
                      }
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      isActive
                        ? "border-amber-400 bg-amber-50 dark:border-amber-500/60 dark:bg-amber-500/10"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
                    } ${c.resolved ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
                        {initials(c.author)}
                      </span>
                      <span className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {c.author}
                      </span>
                      {formatDate(c.createdAt) && (
                        <span className="ml-auto shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
                          {formatDate(c.createdAt)}
                        </span>
                      )}
                    </div>

                    <blockquote className="mt-2 border-l-2 border-amber-300 pl-2 text-[11px] italic text-zinc-500 dark:border-amber-500/50 dark:text-zinc-400">
                      “{c.quote}”
                    </blockquote>

                    <p
                      className={`mt-2 whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300 ${
                        c.resolved ? "line-through" : ""
                      }`}
                    >
                      {c.body}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[11px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleResolved(c.id);
                        }}
                        className="font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        {c.resolved ? "Reopen" : "Resolve"}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                        className="font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
