"use client";

import { useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Home() {
  const [markdown, setMarkdown] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setMarkdown(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
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
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Markdown Preview
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
            <button
              onClick={clear}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
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
        </div>
      </header>

      <main className="flex flex-1 flex-col p-6">
        {markdown ? (
          <article className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="md-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdown}
              </ReactMarkdown>
            </div>
          </article>
        ) : (
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
        )}
      </main>
    </div>
  );
}
