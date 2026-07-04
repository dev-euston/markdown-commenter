# Markdown Commenter — Architecture Design

## Table of contents

- [Context](#context)
  - [System at a glance](#system-at-a-glance)
  - [Main flows](#main-flows)
- [Quality Goals and Constraints](#quality-goals-and-constraints)
- [Fundamental Decisions](#fundamental-decisions)
- [Building Block View](#building-block-view)
- [Runtime View](#runtime-view)
- [Data Model](#data-model)
- [Deployment](#deployment)
- [Decisions, Risks, and Open Questions](#decisions-risks-and-open-questions)
- [References](#references)

***

## Context

Markdown Commenter renders a Markdown document alongside comments that anchor to
locations within it — the way Confluence shows inline and side comments on a
page. It takes **two separate inputs**: a source `.md` file (the document) and a
standalone JSON **comment file** (comments anchored to text in that document),
and produces a rendered view with highlights over the commented passages plus a
side comment list.

The dominant design choice is that the whole app is **client-side**: files are
read in the browser with `FileReader`, comments are held in React state, and the
edited comment file is exported as a downloaded Blob. There is no server-side
persistence and nothing is uploaded. The only server-side concern is satisfying
a strict Content-Security-Policy at render time (see [Deployment](#deployment)).

### System at a glance

```mermaid
flowchart TB
    author["<b>Author / Reviewer</b><br/><i>«Person»</i><br/>Reads the document, adds and resolves comments"]

    subgraph browser["Browser (all logic runs here)"]
        app["<b>Markdown Commenter</b><br/><i>«Next.js client app»</i><br/>Render · highlight · comment"]
    end

    mdfile["<b>.md file</b><br/><i>«local file»</i><br/>Document content"]
    cmtfile["<b>comments.json</b><br/><i>«local file»</i><br/>Anchored comments"]

    author -->|"selects text, writes comments"| app
    mdfile -->|"open / drag-drop (FileReader)"| app
    cmtfile -->|"open (FileReader)"| app
    app -->|"download (Blob)"| cmtfile

    classDef person fill:#08427b,stroke:#073b6f,color:#fff;
    classDef system fill:#1168bd,stroke:#0b4884,color:#fff;
    classDef file fill:#999999,stroke:#6b6b6b,color:#fff;
    class author person;
    class app system;
    class mdfile,cmtfile file;
    style browser fill:#f8f8f8,stroke:#cccccc
```

### Main flows

Each flow is written as *trigger → path → outcome*. Detailed sequence diagrams
are in [Runtime View](#runtime-view).

1. **Load and render a document.** The user opens (or drags) a `.md` file → the
   file is read client-side and rendered with react-markdown + remark-gfm → the
   rendered document appears; any already-loaded comments are highlighted over it.

2. **Load comments.** The user opens a `comments.json` file → it is parsed and
   validated against the schema → comments appear in the sidebar and their quotes
   are highlighted in the document (quotes that no longer match are skipped
   silently).

3. **Add a comment.** The user selects text in the rendered document → a popover
   captures the anchor (`quote` + `occurrence`) and author/body → the comment is
   added to state, highlighted, and listed.

4. **Resolve / reopen / delete a comment.** The user acts on a sidebar entry →
   the comment's state updates → the highlight and list reflect it.

5. **Export comments.** The user clicks *Download comments* → the current
   comment set is serialized to JSON → a file download is triggered.

***

## Quality Goals and Constraints

### Problem Statement

Reviewing a Markdown document and its feedback means juggling the document and a
separate list of comments with no visual link between a comment and the text it
refers to. The product renders both together so a reviewer sees each comment
against its passage, while keeping comments in a portable file that survives
edits elsewhere in the document.

### Goals

- Render a `.md` document and display comments anchored to specific passages.
- Keep comments in a portable, human-readable, hand-editable file.
- Let anchors survive edits elsewhere in the document.
- Run entirely client-side — no upload, no server persistence.
- Deploy cleanly under a strict Content-Security-Policy.

### Non-Goals

- Multi-user real-time collaboration or a comment backend.
- Reply threads (the comment schema is currently flat).
- Fuzzy re-anchoring when the *quoted text itself* is edited.
- Editing the Markdown document in-app (it is read-only).

### Constraints

- **Client-side only.** No server database; all state is in-browser and exported
  as a file.
- **Strict CSP** (`script-src 'self'`) may be injected at the hosting edge with a
  per-request nonce. The app must render dynamically so Next.js stamps that nonce
  onto its inline bootstrap scripts (see [Deployment](#deployment)).
- **Stack is fixed:** Next.js 16 (App Router, Turbopack) · React 19 ·
  TypeScript 5 · Tailwind CSS 4 · npm.

***

## Fundamental Decisions

Each decision sets a contract the rest of the app conforms to.

### FD-1 — Quote + occurrence anchoring

A comment anchors to the **exact `quote` substring** it refers to plus a 1-based
**`occurrence`** index that disambiguates repeated phrases. This is resilient to
edits *elsewhere* in the document and keeps the comment JSON human-readable and
hand-editable. The alternative anchoring models (line/character ranges, or
heading/block references) were rejected: character ranges break on any edit
above the anchor, and block references require a stable block-id scheme the
source Markdown does not carry. Encoded in `src/lib/comments.ts`.

### FD-2 — Highlight over the rendered DOM, not the raw Markdown

Highlights are applied to the **rendered** DOM because a quote can cross multiple
inline elements (e.g. a phrase spanning `**bold**` and plain text). The
highlighter walks the container's text nodes into one concatenated string with an
index map, locates the requested occurrence, and wraps the range in
`<mark class="md-comment-highlight">` elements — one per text-node segment.
Matching against the raw Markdown source was rejected: raw offsets do not map to
what the reader sees or selects. Encoded in `src/lib/highlight.ts`.

### FD-3 — Client-side only; comments live in a standalone JSON file

All logic runs in the browser; the comment set is a versioned JSON file the user
loads and downloads. This keeps the MVP deployable as a static-feeling app with
no backend, no auth, and no data-at-rest concerns, and makes comment files
portable and diffable. The cost accepted: no concurrent editing and no
server-side durability.

### FD-4 — Force per-request rendering for strict CSP

`layout.tsx` calls `await headers()`, which opts the app out of static
prerendering so Next.js renders per request and stamps an edge-injected CSP
nonce onto its inline scripts. A statically prerendered page would bake nonce-less
inline scripts at build time and fail a strict CSP. The bundled `src/proxy.ts`
middleware (which generates its own nonce + CSP) is **redundant when the hosting
edge already injects a CSP** — it exists only for environments that do not.

***

## Building Block View

### Level 1 — Container overview

The app is a single client-rendered page with two supporting libraries and two
presentational components. There are no network services.

```mermaid
flowchart TB
    subgraph app["Markdown Commenter (browser)"]
        direction TB
        page["<b>page.tsx</b><br/>state + orchestration<br/>(file load, selection, export)"]
        rm["<b>ReactMarkdown + remark-gfm</b><br/>renders the document"]
        hl["<b>lib/highlight.ts</b><br/>DOM highlighter<br/>apply / clear / findSelectionQuote"]
        cm["<b>lib/comments.ts</b><br/>schema · parse · serialize"]
        sb["<b>CommentSidebar</b><br/>list · resolve · delete"]
        pop["<b>CommentPopover</b><br/>capture author + body"]
    end

    page -->|renders markdown via| rm
    page -->|apply/clear highlights| hl
    page -->|parse/serialize| cm
    page -->|renders| sb
    page -->|renders on selection| pop
    hl -.->|mutates <mark> in| rm

    classDef orchestrator fill:#c5dbf5,stroke:#6c8ebf,color:#000
    classDef lib fill:#d5e8d4,stroke:#82b366,color:#000
    classDef ui fill:#ffe6cc,stroke:#d79b00,color:#000
    class page orchestrator
    class hl,cm lib
    class rm,sb,pop ui
```

### Container responsibilities

- **`page.tsx`** (`src/app/page.tsx`) — the orchestrator (`"use client"`). Owns
  all state (markdown text, comments, active/pending comment, file names). Reads
  files with `FileReader`, wires the selection→popover→comment flow, re-applies
  highlights on every document/comment change via `useEffect`, and triggers the
  JSON download.
- **ReactMarkdown + remark-gfm** — renders the document with GitHub-flavored
  Markdown (tables, task lists, strikethrough, autolinks). A custom `img`
  component drops empty-`src` images.
- **`lib/highlight.ts`** — the DOM highlighter. `applyHighlights` /
  `clearHighlights` wrap and unwrap `<mark>` ranges over the rendered container;
  `findSelectionQuote` derives `{ quote, occurrence }` from the user's selection.
  Wrapping mutates the DOM, so text pieces are re-collected per comment and
  clearing must run before re-applying.
- **`lib/comments.ts`** — the data model and (de)serialization. Defines
  `Comment` / `CommentFile`, validates on load (`parseCommentFile` throws
  human-readable errors, tolerates missing optional fields), serializes for
  download, and mints ids.
- **`CommentSidebar`** — the side comment list: author, date, quoted passage,
  body, and resolve/reopen/delete actions; reflects the active comment.
- **`CommentPopover`** — the add-comment popover anchored near the selection;
  captures author (remembered across comments) and body; ⌘/Ctrl+Enter submits,
  Esc cancels.

***

## Runtime View

Four scenarios covering the core interactions.

### Scenario 1 — Load document, load comments, highlight (happy path)

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as page.tsx
    participant FR as FileReader
    participant CM as lib/comments
    participant RM as ReactMarkdown
    participant HL as lib/highlight

    U->>P: Open .md file
    P->>FR: readAsText(mdFile)
    FR-->>P: markdown text
    P->>RM: render(markdown)
    RM-->>P: rendered DOM (articleRef)
    U->>P: Open comments.json
    P->>FR: readAsText(jsonFile)
    FR-->>P: json string
    P->>CM: parseCommentFile(json)
    CM-->>P: CommentFile (validated) OR throws
    Note over P: useEffect on [markdown, comments]
    P->>HL: applyHighlights(container, comments, onClick)
    HL->>HL: walk text nodes → locate nth occurrence → wrap <mark>
    HL-->>U: highlighted passages + sidebar list
```

**Failure mode — invalid comment file.** `parseCommentFile` throws a
human-readable error (bad JSON, wrong version, missing `comments` array, or a
malformed comment); `page.tsx` catches it and shows an `alert`, leaving the
document and any prior comments intact.

**Degraded case — quote no longer matches.** If a comment's `quote`/`occurrence`
is not found in the rendered text (`nthIndexOf` returns −1), that comment is
**skipped silently** — no highlight — but it still appears in the sidebar.

### Scenario 2 — Add a comment from a selection

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as page.tsx
    participant HL as lib/highlight
    participant POP as CommentPopover

    U->>P: Select text in the document (mouseUp)
    P->>HL: findSelectionQuote(container, selection)
    HL->>HL: count matches before selection → occurrence
    HL-->>P: { quote, occurrence } OR null
    alt selection valid
        P->>POP: open near selection rect
        U->>POP: enter author + body, submit (⌘/Ctrl+Enter)
        POP-->>P: onSubmit(author, body)
        P->>P: newCommentId(), append to comments, set active
        Note over P: useEffect re-applies highlights
    else empty / outside container
        HL-->>P: null → no popover
    end
```

### Scenario 3 — Resolve / reopen / delete

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant SB as CommentSidebar
    participant P as page.tsx
    participant HL as lib/highlight

    U->>SB: Click Resolve / Reopen / Delete
    SB->>P: onToggleResolved(id) / onDelete(id)
    P->>P: update comments state
    Note over P: useEffect on [comments] re-runs
    P->>HL: clearHighlights + applyHighlights
    HL-->>U: resolved marks styled / removed, list updated
```

### Scenario 4 — Export comments

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as page.tsx
    participant CM as lib/comments

    U->>P: Click Download comments
    P->>CM: serializeComments(comments, documentName)
    CM-->>P: pretty-printed JSON
    P->>P: Blob → object URL → <a download>.click()
    P-->>U: comments.json downloaded
```

***

## Data Model

The comment file is the single persisted artifact. It is a versioned JSON object;
the schema lives in `src/lib/comments.ts`.

```mermaid
erDiagram
    COMMENT_FILE ||--o{ COMMENT : contains
    COMMENT_FILE {
        int version "must be 1"
        string documentName "optional, informational"
    }
    COMMENT {
        string id PK "stable unique id"
        string quote "exact document substring"
        int occurrence "1-based Nth match of quote"
        string author
        string body
        string createdAt "ISO-8601"
        boolean resolved
    }
```

### Storage decisions

- **No database.** The comment file is loaded from and saved to the user's local
  disk; live state is React state in `page.tsx`.
- **Versioned envelope.** `CommentFile.version` is pinned to `1`;
  `parseCommentFile` rejects other versions so the format can evolve
  deliberately.
- **Anchor fields.** `quote` + `occurrence` are the anchor (see [FD-1](#fd-1--quote--occurrence-anchoring)).
  `id` is stable so the UI can track active/selected comments across renders.
- **Tolerant parsing.** Missing optional fields default (`author` → "Anonymous",
  `body` → "", `createdAt` → epoch, `resolved` → false, `id` → positional),
  so lightly hand-authored files still load.

***

## Deployment

Packaged as a Docker image from the pre-built Next.js `.next/standalone` output —
run `npm run build` locally first; the image does not build. The app is served as
a Next.js standalone server behind whatever hosting edge terminates TLS and
applies the CSP.

```mermaid
flowchart LR
    dev["Local build<br/>npm run build → .next/standalone"]
    img["Docker image<br/>copies standalone output"]
    edge["Hosting edge<br/>may inject CSP + per-request nonce"]
    app["Next.js app<br/>renders dynamically (await headers())<br/>stamps nonce on inline scripts"]
    user["Browser"]

    dev --> img --> edge --> app --> user
```

**The CSP contract (the one deployment gotcha).** When the hosting edge enforces
`script-src 'self'` and injects a `Content-Security-Policy` header with a
per-request nonce, Next.js stamps that nonce onto its inline bootstrap/hydration
scripts **only if the page renders dynamically**. A statically prerendered page
bakes nonce-less scripts at build time and fails CSP. The workaround: `layout.tsx`
calls `await headers()` to force per-request rendering. Verify a route shows
`ƒ (Dynamic)`, not `○ (Static)`, in `next build` output.

`src/proxy.ts` (middleware generating its own nonce + CSP) is redundant when the
edge already injects a CSP, and would only be needed in an environment that
provides none of its own.

***

## Testing

Tests run on **Vitest** with a **jsdom** environment and Testing Library; the
pure libraries and presentational components are covered directly. There is no
network or server to mock — the whole app is client-side.

```
npm test            # run the suite once
npm run test:watch  # watch mode
npm run test:coverage  # run with a v8 coverage report + thresholds
```

- **`src/lib/comments.test.ts`** — schema validation and (de)serialization:
  valid/invalid shapes, version and `comments`-array rejection, per-field
  defaults, `occurrence` flooring/clamping, and a serialize→parse round-trip.
- **`src/lib/highlight.test.ts`** — the DOM highlighter against jsdom fixtures:
  single and repeated-occurrence wrapping, quotes spanning multiple inline
  elements, missing/empty quotes skipped, resolved marking, click callbacks,
  clear/re-apply, and `findSelectionQuote` occurrence counting.
- **`src/components/*.test.tsx`** — `CommentSidebar` and `CommentPopover`:
  rendering, initials/date formatting, select/resolve/delete callbacks, and
  keyboard interactions (Enter/Space, ⌘/Ctrl+Enter, Esc, click-away).

Coverage thresholds (lines/functions/statements ≥ 90%, branches ≥ 85%) are
enforced in `vitest.config.ts`; the build fails if coverage regresses. The
orchestration in `page.tsx` is exercised indirectly through its extracted
libraries and components rather than by a full end-to-end harness.

***

## Decisions, Risks, and Open Questions

### Key decisions

1. **Quote + occurrence anchoring (FD-1).** Resilient to edits elsewhere;
   hand-editable. Consequence: no resilience when the quoted text itself changes.
2. **Highlight over rendered DOM (FD-2).** Matches what the user sees and selects.
   Consequence: highlighter must re-collect text pieces per comment because
   wrapping mutates the DOM.
3. **Client-side only (FD-3).** No backend, portable comment files. Consequence:
   no concurrent editing, no server durability.
4. **Force dynamic render (FD-4).** Satisfies a strict CSP. Consequence:
   the app opts out of static prerendering.

### Risks and open questions

| # | Type     | Item | Impact | Resolution path |
| - | -------- | ---- | ------ | --------------- |
| 1 | Question | **Anchor resilience** — comments do not survive edits to the *quoted text itself*; there is no fuzzy re-anchoring. | Medium — dropped anchors silently lose their highlight | Decide whether/how to re-resolve dropped anchors (fuzzy match, surrounding context) |
| 2 | Question | **Reply threads** — schema is flat (one body per comment). | Low — limits discussion | Extend schema with a replies array + `version` bump if needed |
| 3 | Risk | **Duplicate/overlapping quotes** — occurrence counting depends on the rendered text being stable between load and selection. | Low | Covered by re-collecting pieces per comment; watch when adding live document editing |
| 4 | Risk | **Static-prerender regression** — a future change could re-enable static rendering and break CSP under a strict-CSP host. | Medium | Keep the `ƒ (Dynamic)` check in the build/verify step |

***

## References

- `CLAUDE.md` — project conventions, stack, deployment gotcha
- `README.md` — features, comment file format, getting started
- `src/lib/comments.ts` — comment schema + parse/serialize (source of truth for the data model)
- `src/lib/highlight.ts` — DOM highlighter
- `src/app/page.tsx` — orchestration and state
- `vitest.config.ts` — test runner + coverage thresholds; `*.test.ts(x)` next to sources
