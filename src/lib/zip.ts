/**
 * Zip pack/unpack for a single document + its comments file.
 *
 * This is fully client-side (no server involvement): the browser reads and
 * writes the archive bytes in-memory via `fflate`. Kept React-free so it can be
 * unit-tested and keeps `page.tsx` thin.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export interface ZipContents {
  markdown: string;
  markdownName: string;
  commentsJson: string;
  commentsName: string;
}

const MARKDOWN_RE = /\.(md|markdown)$/i;
const JSON_RE = /\.json$/i;

/** True for a zip entry that lives at the archive root (no path separator). */
function isRootEntry(name: string): boolean {
  return !name.includes("/");
}

/**
 * Extract a document and its comments file from a zip archive.
 *
 * Only root-level, non-directory entries are considered. The comments JSON is
 * returned raw (unparsed) so the caller can run `parseCommentFile` and surface
 * its error message, keeping error handling consistent with `loadCommentFile`.
 */
export function extractZip(data: Uint8Array): ZipContents {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data);
  } catch {
    throw new Error("File is not a valid zip archive.");
  }

  const rootNames = Object.keys(entries).filter(
    (name) => isRootEntry(name) && !name.endsWith("/")
  );

  const markdownNames = rootNames.filter((name) => MARKDOWN_RE.test(name));
  if (markdownNames.length === 0) {
    throw new Error("Zip does not contain a Markdown (.md/.markdown) file.");
  }
  if (markdownNames.length > 1) {
    throw new Error("Zip contains more than one Markdown file.");
  }

  const jsonNames = rootNames.filter((name) => JSON_RE.test(name));
  if (jsonNames.length === 0) {
    throw new Error("Zip does not contain a comments (.json) file.");
  }
  if (jsonNames.length > 1) {
    throw new Error("Zip contains more than one comments file.");
  }

  const markdownName = markdownNames[0];
  const commentsName = jsonNames[0];

  return {
    markdown: strFromU8(entries[markdownName]),
    markdownName,
    commentsJson: strFromU8(entries[commentsName]),
    commentsName,
  };
}

/** Package a document and its comments JSON into a zip archive (root entries). */
export function buildZip(contents: ZipContents): Uint8Array {
  return zipSync({
    [contents.markdownName]: strToU8(contents.markdown),
    [contents.commentsName]: strToU8(contents.commentsJson),
  });
}

/**
 * Derive the archive filename from the loaded markdown name: strip a trailing
 * .md/.markdown extension and append ".zip" (e.g. "report.md" -> "report.zip").
 */
export function zipFileNameFor(markdownFileName: string): string {
  if (!markdownFileName) return "markdown-commenter.zip";
  const base = markdownFileName.replace(MARKDOWN_RE, "");
  return `${base}.zip`;
}
