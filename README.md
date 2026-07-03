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

## Status

Early development (MVP). Markdown loading and preview are in place; the
commenting layer is not built yet. The comment file format, output target,
and anchoring model are still being defined.
