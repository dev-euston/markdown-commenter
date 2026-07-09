import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchGitLabRawFile,
  fileNameFromPath,
  parseGitLabBlobUrl,
} from "./gitlab";

describe("parseGitLabBlobUrl", () => {
  it("parses a simple blob URL", () => {
    expect(
      parseGitLabBlobUrl(
        "https://sgts.gitlab-dedicated.com/group/project/-/blob/main/README.md"
      )
    ).toEqual({
      projectPath: "group/project",
      ref: "main",
      filePath: "README.md",
    });
  });

  it("parses a nested-subgroup blob URL", () => {
    expect(
      parseGitLabBlobUrl(
        "https://sgts.gitlab-dedicated.com/group/subgroup/project/-/blob/main/docs/file.md"
      )
    ).toEqual({
      projectPath: "group/subgroup/project",
      ref: "main",
      filePath: "docs/file.md",
    });
  });

  it("throws for a non-matching host", () => {
    expect(() =>
      parseGitLabBlobUrl(
        "https://gitlab.com/group/project/-/blob/main/README.md"
      )
    ).toThrow(/sgts\.gitlab-dedicated\.com/);
  });

  it("throws for a URL without /-/blob/", () => {
    expect(() =>
      parseGitLabBlobUrl(
        "https://sgts.gitlab-dedicated.com/group/project/tree/main"
      )
    ).toThrow(/\/-\/blob\//);
  });

  it("throws for a malformed URL", () => {
    expect(() => parseGitLabBlobUrl("not a url")).toThrow(/valid URL/);
  });
});

describe("fetchGitLabRawFile", () => {
  const ref = {
    projectPath: "group/subgroup/project",
    ref: "main",
    filePath: "docs/file.md",
  };
  const token = "super-secret-token";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the URL-encoded raw API URL and sends the token in PRIVATE-TOKEN only", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# File",
    });
    vi.stubGlobal("fetch", fetchMock);

    const text = await fetchGitLabRawFile(ref, token);
    expect(text).toBe("# File");

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      "https://sgts.gitlab-dedicated.com/api/v4/projects/group%2Fsubgroup%2Fproject/repository/files/docs%2Ffile.md/raw?ref=main"
    );
    expect(init).toEqual({ headers: { "PRIVATE-TOKEN": token } });
  });

  it("maps 401 to an unauthorized message without leaking the token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGitLabRawFile(ref, token)).rejects.toThrow(
      /unauthorized|rejected the token/i
    );
    await expect(fetchGitLabRawFile(ref, token)).rejects.not.toThrow(
      new RegExp(token)
    );
  });

  it("maps 403 to an unauthorized message without leaking the token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetchMock);

    let message = "";
    try {
      await fetchGitLabRawFile(ref, token);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/unauthorized|rejected the token/i);
    expect(message).not.toContain(token);
  });

  it("maps 404 to a not-found message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGitLabRawFile(ref, token)).rejects.toThrow(/not found/i);
  });

  it("maps other non-ok statuses to a generic failure including the status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGitLabRawFile(ref, token)).rejects.toThrow(/500/);
  });

  it("throws a reach-GitLab error when fetch rejects, without the token", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("blocked by CSP"));
    vi.stubGlobal("fetch", fetchMock);

    let message = "";
    try {
      await fetchGitLabRawFile(ref, token);
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/could not reach gitlab/i);
    expect(message).not.toContain(token);
  });
});

describe("fileNameFromPath", () => {
  it("returns the last segment for a nested path", () => {
    expect(fileNameFromPath("docs/guides/file.md")).toBe("file.md");
  });

  it("returns the whole name for a flat path", () => {
    expect(fileNameFromPath("README.md")).toBe("README.md");
  });
});
