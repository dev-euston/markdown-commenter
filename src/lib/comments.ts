/**
 * Comment data model and (de)serialization for the comment JSON file.
 *
 * Anchoring contract: a comment stores the exact `quote` substring it refers
 * to, plus a 1-based `occurrence` index that disambiguates repeated phrases.
 * This is resilient to edits elsewhere in the document and keeps the JSON
 * human-readable / hand-editable.
 */

export interface Comment {
  /** Stable unique id. */
  id: string;
  /** Exact document substring this comment anchors to. */
  quote: string;
  /** 1-based Nth occurrence of `quote` in the document text. */
  occurrence: number;
  author: string;
  body: string;
  /** ISO-8601 timestamp. */
  createdAt: string;
  resolved: boolean;
}

export interface CommentFile {
  version: 1;
  /** Optional, informational — the .md file these comments were made against. */
  documentName?: string;
  comments: Comment[];
}

export const COMMENT_FILE_VERSION = 1 as const;

/** Create an empty comment file, optionally tagged with a document name. */
export function emptyCommentFile(documentName?: string): CommentFile {
  return { version: COMMENT_FILE_VERSION, documentName, comments: [] };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse and validate the contents of a comment JSON file.
 * Throws an Error with a human-readable message when the shape is invalid.
 */
export function parseCommentFile(json: string): CommentFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("File is not valid JSON.");
  }

  if (!isObject(data)) {
    throw new Error("Expected a JSON object at the top level.");
  }

  if (data.version !== COMMENT_FILE_VERSION) {
    throw new Error(
      `Unsupported comment file version (expected ${COMMENT_FILE_VERSION}).`
    );
  }

  if (!Array.isArray(data.comments)) {
    throw new Error('Missing "comments" array.');
  }

  const comments = data.comments.map((raw, i) => parseComment(raw, i));

  return {
    version: COMMENT_FILE_VERSION,
    documentName:
      typeof data.documentName === "string" ? data.documentName : undefined,
    comments,
  };
}

function parseComment(raw: unknown, index: number): Comment {
  if (!isObject(raw)) {
    throw new Error(`Comment at index ${index} is not an object.`);
  }

  const quote = raw.quote;
  if (typeof quote !== "string" || quote.length === 0) {
    throw new Error(`Comment at index ${index} is missing a non-empty "quote".`);
  }

  const occurrence =
    typeof raw.occurrence === "number" && raw.occurrence >= 1
      ? Math.floor(raw.occurrence)
      : 1;

  return {
    id:
      typeof raw.id === "string" && raw.id.length > 0
        ? raw.id
        : `c${index + 1}`,
    quote,
    occurrence,
    author: typeof raw.author === "string" ? raw.author : "Anonymous",
    body: typeof raw.body === "string" ? raw.body : "",
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date(0).toISOString(),
    resolved: raw.resolved === true,
  };
}

/** Serialize comments to a pretty-printed JSON string for download. */
export function serializeComments(
  comments: Comment[],
  documentName?: string
): string {
  const file: CommentFile = {
    version: COMMENT_FILE_VERSION,
    documentName,
    comments,
  };
  return JSON.stringify(file, null, 2);
}

/** Generate a reasonably-unique comment id without external deps. */
export function newCommentId(): string {
  return `c-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
