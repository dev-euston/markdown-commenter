import { describe, expect, it } from "vitest";
import {
  COMMENT_FILE_VERSION,
  type Comment,
  emptyCommentFile,
  newCommentId,
  parseCommentFile,
  serializeComments,
} from "./comments";

describe("emptyCommentFile", () => {
  it("returns a versioned, empty file", () => {
    expect(emptyCommentFile()).toEqual({
      version: COMMENT_FILE_VERSION,
      documentName: undefined,
      comments: [],
    });
  });

  it("tags the document name when provided", () => {
    expect(emptyCommentFile("doc.md").documentName).toBe("doc.md");
  });
});

describe("parseCommentFile", () => {
  function fileWith(comments: unknown[]): string {
    return JSON.stringify({ version: COMMENT_FILE_VERSION, comments });
  }

  it("parses a valid file with a fully-specified comment", () => {
    const comment: Comment = {
      id: "abc",
      quote: "hello",
      occurrence: 2,
      author: "Ada",
      body: "a note",
      createdAt: "2024-01-01T00:00:00.000Z",
      resolved: true,
    };
    const parsed = parseCommentFile(
      JSON.stringify({
        version: COMMENT_FILE_VERSION,
        documentName: "doc.md",
        comments: [comment],
      })
    );
    expect(parsed.documentName).toBe("doc.md");
    expect(parsed.comments).toEqual([comment]);
  });

  it("throws on non-JSON input", () => {
    expect(() => parseCommentFile("not json")).toThrow(/valid JSON/);
  });

  it("throws when the top level is not an object", () => {
    expect(() => parseCommentFile("[]")).toThrow(/top level/);
    expect(() => parseCommentFile("42")).toThrow(/top level/);
  });

  it("throws on an unsupported version", () => {
    expect(() =>
      parseCommentFile(JSON.stringify({ version: 99, comments: [] }))
    ).toThrow(/version/);
  });

  it("throws when comments is missing or not an array", () => {
    expect(() =>
      parseCommentFile(JSON.stringify({ version: COMMENT_FILE_VERSION }))
    ).toThrow(/comments/);
    expect(() =>
      parseCommentFile(
        JSON.stringify({ version: COMMENT_FILE_VERSION, comments: {} })
      )
    ).toThrow(/comments/);
  });

  it("throws when a comment is not an object", () => {
    expect(() => parseCommentFile(fileWith(["nope"]))).toThrow(/index 0/);
  });

  it("throws when a comment lacks a non-empty quote", () => {
    expect(() => parseCommentFile(fileWith([{ quote: "" }]))).toThrow(
      /index 0.*quote/
    );
    expect(() => parseCommentFile(fileWith([{ author: "x" }]))).toThrow(
      /index 0.*quote/
    );
  });

  it("fills defaults for optional fields", () => {
    const [c] = parseCommentFile(fileWith([{ quote: "hi" }])).comments;
    expect(c.id).toBe("c1");
    expect(c.occurrence).toBe(1);
    expect(c.author).toBe("Anonymous");
    expect(c.body).toBe("");
    expect(c.resolved).toBe(false);
    expect(c.createdAt).toBe(new Date(0).toISOString());
  });

  it("floors and clamps occurrence, treating < 1 as 1", () => {
    const parse = (occurrence: unknown) =>
      parseCommentFile(fileWith([{ quote: "hi", occurrence }])).comments[0]
        .occurrence;
    expect(parse(3.9)).toBe(3);
    expect(parse(0)).toBe(1);
    expect(parse(-5)).toBe(1);
    expect(parse("2")).toBe(1);
  });

  it("derives sequential ids from index when id is missing", () => {
    const { comments } = parseCommentFile(
      fileWith([{ quote: "a" }, { quote: "b" }])
    );
    expect(comments.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("ignores a non-string documentName", () => {
    const parsed = parseCommentFile(
      JSON.stringify({
        version: COMMENT_FILE_VERSION,
        documentName: 123,
        comments: [],
      })
    );
    expect(parsed.documentName).toBeUndefined();
  });
});

describe("serializeComments", () => {
  it("round-trips through parseCommentFile", () => {
    const comments: Comment[] = [
      {
        id: "x1",
        quote: "quoted",
        occurrence: 1,
        author: "Grace",
        body: "body",
        createdAt: "2024-06-01T12:00:00.000Z",
        resolved: false,
      },
    ];
    const json = serializeComments(comments, "doc.md");
    const parsed = parseCommentFile(json);
    expect(parsed.comments).toEqual(comments);
    expect(parsed.documentName).toBe("doc.md");
  });

  it("pretty-prints with two-space indentation", () => {
    expect(serializeComments([])).toContain("\n  ");
  });
});

describe("newCommentId", () => {
  it("produces unique, prefixed ids", () => {
    const a = newCommentId();
    const b = newCommentId();
    expect(a).toMatch(/^c-/);
    expect(a).not.toBe(b);
  });
});
