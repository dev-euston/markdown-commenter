import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZip, extractZip, zipFileNameFor } from "./zip";

/** Build a zip Uint8Array from a map of entry name -> string content. */
function makeZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) {
    entries[name] = strToU8(content);
  }
  return zipSync(entries);
}

describe("extractZip", () => {
  it("returns markdown and comments content with their names", () => {
    const zip = makeZip({
      "report.md": "# Title",
      "report.json": '{"version":1,"comments":[]}',
    });
    const contents = extractZip(zip);
    expect(contents.markdown).toBe("# Title");
    expect(contents.markdownName).toBe("report.md");
    expect(contents.commentsJson).toBe('{"version":1,"comments":[]}');
    expect(contents.commentsName).toBe("report.json");
  });

  it("accepts a .markdown extension for the document entry", () => {
    const zip = makeZip({
      "notes.markdown": "hi",
      "notes.json": "{}",
    });
    expect(extractZip(zip).markdownName).toBe("notes.markdown");
  });

  it("throws when there is no markdown entry", () => {
    const zip = makeZip({ "report.json": "{}" });
    expect(() => extractZip(zip)).toThrow(/Markdown/);
  });

  it("throws when more than one markdown entry is present", () => {
    const zip = makeZip({
      "a.md": "x",
      "b.md": "y",
      "report.json": "{}",
    });
    expect(() => extractZip(zip)).toThrow(/more than one Markdown/);
  });

  it("throws when there is no comments json entry", () => {
    const zip = makeZip({ "report.md": "# Title" });
    expect(() => extractZip(zip)).toThrow(/comments/);
  });

  it("throws when more than one comments json entry is present", () => {
    const zip = makeZip({
      "report.md": "# Title",
      "a.json": "{}",
      "b.json": "{}",
    });
    expect(() => extractZip(zip)).toThrow(/more than one comments/);
  });

  it("throws when passed bytes that are not a zip archive", () => {
    expect(() => extractZip(strToU8("not a zip"))).toThrow(/valid zip/);
  });

  it("returns comments JSON raw without validating it", () => {
    const zip = makeZip({
      "report.md": "# Title",
      "report.json": "{ this is not valid json",
    });
    expect(extractZip(zip).commentsJson).toBe("{ this is not valid json");
  });

  it("ignores nested (non-root) entries when selecting", () => {
    const zip = makeZip({
      "sub/dir.md": "nested",
      "report.md": "# Title",
      "report.json": "{}",
    });
    const contents = extractZip(zip);
    expect(contents.markdownName).toBe("report.md");
    expect(contents.markdown).toBe("# Title");
  });
});

describe("buildZip", () => {
  it("round-trips content and names through extractZip", () => {
    const original = {
      markdown: "# Hello\n\nWorld",
      markdownName: "doc.md",
      commentsJson: '{"version":1,"comments":[]}',
      commentsName: "doc.json",
    };
    const contents = extractZip(buildZip(original));
    expect(contents).toEqual(original);
  });
});

describe("zipFileNameFor", () => {
  it("derives the archive name from the document name", () => {
    expect(zipFileNameFor("report.md")).toBe("report.zip");
    expect(zipFileNameFor("notes.markdown")).toBe("notes.zip");
  });

  it("falls back when the name is empty", () => {
    expect(zipFileNameFor("")).toBe("markdown-commenter.zip");
  });
});
