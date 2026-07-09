# Markdown Commenter

Render a Markdown document alongside its comments — similar to how Confluence
displays inline and side comments on a page.

## Overview

Markdown Commenter takes two inputs:

1. A source Markdown (`.md`) file — the document content.
2. A separate **comment file** — comments that anchor to locations within the
   document.

It produces a rendered view of the document with those comments displayed
against the text they refer to.

## Current features

- **Markdown preview** — load a `.md`/`.markdown` file (click to browse or
  drag-and-drop) and view it rendered with GitHub-flavored Markdown support
  (tables, task lists, strikethrough, autolinks). Files are read client-side,
  so nothing is uploaded.
- **Inline commenting** — select text in the rendered document to attach a
  comment; highlighted passages and a side comment list stay in sync
  (Confluence-style). Click a highlight or a sidebar entry to focus the pair.
- **Comment threads** — each comment carries an author, timestamp, and
  resolved state. Comments can be resolved/reopened and deleted.
- **Separate comment file** — comments live in a standalone JSON file (`Open
  comments` to load, `New comments` to start fresh, `Download comments` to
  export). Comments anchor by the exact quoted text plus an occurrence index,
  so they survive edits elsewhere in the document. Everything stays
  client-side.
- **Zip bundle** — the document and its comments file can be packaged together:
  `Open .zip` loads a single archive (one `.md`/`.markdown` + one `.json` at the
  archive root) and `Download .zip` exports the pair as one file. Packing and
  unpacking are done in-browser with `fflate`; nothing is uploaded.
- **Onboarding tour** — a three-step walkthrough (load → comment → download)
  auto-launches on a first visit and can be reopened any time via the `? Help`
  button. Each step spotlights the control it describes; the "seen" flag is kept
  in `localStorage`, so the tour never reappears once dismissed.
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render as SVG diagrams
  in the browser (nothing is uploaded). Each block has a per-block toggle to
  reveal its raw source, and commenting works in that source view. Selecting a
  comment anchored to a diagram flips its block to source so the highlight can
  be scrolled to and flashed.
- **Bundled docs** — a `Docs` menu loads the project's own docs (pitch deck,
  architecture) straight into the viewer. They ship as same-origin static
  assets under `public/docs/` and are fetched in-browser, so they double as
  ready-made sample documents for trying out commenting.
- **Load from GitLab** — paste a file URL from the org's self-hosted GitLab
  (`sgts.gitlab-dedicated.com`) plus a per-session access token to load a
  Markdown document straight from the repo. The token is sent only to the
  GitLab origin (in the `PRIVATE-TOKEN` header), never persisted or logged, and
  cleared from state after a successful load.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · ESLint.

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3041](http://localhost:3041).

### Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — run ESLint

## Docker

Build the app locally first, then package it into a slim image. The image
only copies the Next.js
[standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
from `.next/` — it does **not** build inside Docker.

```bash
npm run build   # produces .next/standalone and .next/static
```

### With Docker Compose (recommended)

```bash
cp .env.example .env.local   # optional — edit if you need runtime env vars
docker compose up --build
```

The app is served at [http://localhost:3000](http://localhost:3000).

### With plain Docker

```bash
docker build -t markdown-commenter .
docker run -p 3000:3000 markdown-commenter
```

### Environment variables

- Copy `.env.example` to `.env.local` (gitignored) for local values.
- Compose loads `.env.local` at runtime via `env_file`.
- **Server-only** vars (no prefix) are read at container start — supply them
  through `.env.local` or `-e`.
- **`NEXT_PUBLIC_*`** vars are inlined into the client bundle at **build time**,
  so they must be present during `docker build`. Pass them as build args if you
  add any.

## Comment file format

A comment file is JSON:

```json
{
  "version": 1,
  "documentName": "example.md",
  "comments": [
    {
      "id": "c-abc123",
      "quote": "exact text from the document",
      "occurrence": 1,
      "author": "Ada",
      "body": "the comment text",
      "createdAt": "2026-07-04T00:00:00.000Z",
      "resolved": false
    }
  ]
}
```

- **`quote`** — the exact document substring the comment anchors to.
- **`occurrence`** — the 1-based Nth match of `quote`, disambiguating repeated
  phrases. A comment whose `quote` no longer appears is skipped silently.

## Status

Early development (MVP). Markdown preview and the client-side commenting layer
(inline highlights, side comment list, JSON comment file load/save) are in
place. Comment anchoring, output target, and schema are settled as described
above; anchor re-resolution after heavy edits is not yet handled beyond the
quote/occurrence match.
