import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUNDLED_DOCS, loadBundledDoc } from "./docs";

describe("BUNDLED_DOCS registry", () => {
  it("contains exactly the pitch deck and architecture entries", () => {
    expect(BUNDLED_DOCS).toHaveLength(2);
    expect(BUNDLED_DOCS.map((d) => d.key)).toEqual([
      "pitchdeck",
      "architecture",
    ]);

    const [pitch, arch] = BUNDLED_DOCS;
    expect(pitch).toEqual({
      key: "pitchdeck",
      label: "Pitch deck",
      fileName: "pitchdeck.md",
      path: "/docs/pitchdeck.md",
    });
    expect(arch).toEqual({
      key: "architecture",
      label: "Architecture",
      fileName: "architecture.md",
      path: "/docs/architecture.md",
    });
  });

  it("does not include collab-google-drive.md or README.md", () => {
    const paths = BUNDLED_DOCS.map((d) => d.path);
    const fileNames = BUNDLED_DOCS.map((d) => d.fileName);
    expect(paths.some((p) => /collab-google-drive|readme/i.test(p))).toBe(
      false
    );
    expect(
      fileNames.some((f) => /collab-google-drive|readme/i.test(f))
    ).toBe(false);
  });
});

describe("loadBundledDoc", () => {
  const doc = BUNDLED_DOCS[0];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves to the fetched text when the response is ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Doc",
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = await loadBundledDoc(doc);
    expect(text).toBe("# Doc");
    expect(fetchMock).toHaveBeenCalledWith(doc.path);
  });

  it("throws when the response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadBundledDoc(doc)).rejects.toThrow();
  });
});
