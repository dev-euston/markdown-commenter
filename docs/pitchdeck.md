---
marp: true
theme: default
paginate: true
---

# Markdown Commenter

Review Markdown documents with comments anchored right to the passages they refer to.

---

## Problem

Reviewing a Markdown document and its feedback today means juggling two things at once:

- The **document** in one place.
- A **separate list of comments** in another.

There's no visual link between a comment and the passage it refers to, so the reader has to reconstruct that connection by hand.

---

## Solution

**Markdown Commenter renders your `.md` document alongside its comments** — the way Confluence shows inline and side comments on a page.

- **Inline highlights** sit directly over the commented text.
- A **synced side comment list** stays in step with those highlights — click either one to focus the pair.

---

## Solution — portable & private

- Comments live in a **portable, human-readable, hand-editable JSON file**.
- Everything runs **entirely client-side in the browser**: files are read with `FileReader`.
- **Nothing is uploaded**, and there's no server persistence.

---

## How it works — two files in

- **A source `.md` file** — the document content.
- **A standalone comments JSON file** — the anchored comments.

Open or drag-and-drop to load each one; download to export your comments.

Documents render with **GitHub-flavored Markdown** (tables, task lists, strikethrough, autolinks).

---

## How it works — commenting

- **Select text** in the rendered document to add a comment (author + body).
- Comments anchor by the **exact quoted text plus a 1-based occurrence index**, so they survive edits made elsewhere in the document.
- **Resolve, reopen, or delete** any comment from the sidebar.

Reading and writing are all client-side — your files stay on your machine.
