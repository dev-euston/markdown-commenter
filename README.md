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

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · ESLint.

## Getting started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm start` — serve the production build
- `npm run lint` — run ESLint

## Status

Early development (MVP). The Next.js + TypeScript app is scaffolded; the
commenter features are not built yet. The comment file format, output target,
and anchoring model are still being defined.
