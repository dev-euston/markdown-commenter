import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initialize = vi.fn();
const render = vi.fn(async () => ({
  svg: "<svg data-testid='diagram'></svg>",
}));

vi.mock("mermaid", () => ({
  default: { initialize, render },
}));

describe("renderMermaid", () => {
  beforeEach(() => {
    // Reset the module-level singleton guard so each test starts uninitialized.
    vi.resetModules();
    initialize.mockClear();
    render.mockClear();
    render.mockResolvedValue({ svg: "<svg data-testid='diagram'></svg>" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the rendered svg string", async () => {
    const { renderMermaid } = await import("./mermaid");
    const svg = await renderMermaid("id-1", "graph TD; A-->B");
    expect(svg).toBe("<svg data-testid='diagram'></svg>");
  });

  it("initializes mermaid with startOnLoad:false and strict security", async () => {
    const { renderMermaid } = await import("./mermaid");
    await renderMermaid("id-1", "graph TD; A-->B");
    expect(initialize).toHaveBeenCalledWith({
      startOnLoad: false,
      securityLevel: "strict",
    });
  });

  it("initializes only once across multiple renders (singleton guard)", async () => {
    const { renderMermaid } = await import("./mermaid");
    await renderMermaid("id-1", "graph TD; A-->B");
    await renderMermaid("id-2", "graph LR; C-->D");
    await renderMermaid("id-3", "graph LR; E-->F");
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it("passes the id and source through to mermaid.render", async () => {
    const { renderMermaid } = await import("./mermaid");
    await renderMermaid("my-id", "graph TD; A-->B");
    expect(render).toHaveBeenCalledWith("my-id", "graph TD; A-->B");
  });

  it("propagates a render rejection as a thrown error", async () => {
    render.mockRejectedValueOnce(new Error("bad syntax"));
    const { renderMermaid } = await import("./mermaid");
    await expect(renderMermaid("id-1", "not valid")).rejects.toThrow(
      "bad syntax"
    );
  });
});
