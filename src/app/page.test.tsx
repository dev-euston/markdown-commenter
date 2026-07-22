import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "./page";
import { hasSeenTour, markTourSeen } from "@/lib/tour";
import { renderMermaid } from "@/lib/mermaid";

// Mock mermaid so jsdom never attempts real diagram rendering.
vi.mock("@/lib/mermaid", () => ({
  renderMermaid: vi.fn(),
}));

/** Load a Markdown document via the hidden .md file input. */
async function loadMarkdown(container: HTMLElement, text = "# Hello world") {
  const input = container.querySelector(
    'input[accept*=".md"]'
  ) as HTMLInputElement;
  const file = new File([text], "doc.md", { type: "text/markdown" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole("button", { name: "New comments" });
}

/** Load a comments JSON file via the hidden comments input. */
async function loadComments(container: HTMLElement, bodies: string[]) {
  const comments = bodies.map((body, i) => ({
    id: `c${i + 1}`,
    quote: "Hello",
    occurrence: 1,
    author: "Ada",
    body,
    createdAt: new Date(0).toISOString(),
    resolved: false,
  }));
  const json = JSON.stringify({ version: 1, comments });
  const input = container.querySelector(
    'input[accept*=".json"]'
  ) as HTMLInputElement;
  const file = new File([json], "comments.json", { type: "application/json" });
  fireEvent.change(input, { target: { files: [file] } });
  for (const body of bodies) {
    await screen.findByText(body);
  }
}

describe("Home page", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("auto-launches the tour for a first-time user", () => {
    render(<Home />);
    expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
  });

  it("does not auto-launch the tour for a returning user", () => {
    markTourSeen();
    render(<Home />);
    expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
  });

  it("re-launches the tour from the Help button in one click, incl. empty state", async () => {
    markTourSeen();
    render(<Home />);
    expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
  });

  it("persists the seen flag when the tour is dismissed via Skip", async () => {
    render(<Home />);
    expect(screen.getByTestId("onboarding-tour")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByTestId("onboarding-tour")).not.toBeInTheDocument();
    expect(hasSeenTour()).toBe(true);
  });

  it("prompts before resetting when comments exist and cancels on decline", async () => {
    markTourSeen();
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: "New comments" }));
    expect(confirm).toHaveBeenCalled();
    // Comment survives a declined reset.
    expect(screen.getByText("a note")).toBeInTheDocument();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "New comments" }));
    await waitFor(() =>
      expect(screen.queryByText("a note")).not.toBeInTheDocument()
    );
  });

  it("does not prompt when resetting with no comments", async () => {
    markTourSeen();
    const { container } = render(<Home />);
    await loadMarkdown(container);

    const confirm = vi.spyOn(window, "confirm");
    await userEvent.click(screen.getByRole("button", { name: "New comments" }));
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe("Home page — Docs nav", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    markTourSeen();
    vi.mocked(renderMermaid).mockReset();
    vi.mocked(renderMermaid).mockResolvedValue(
      "<svg data-testid='mermaid-svg'></svg>"
    );
    fetchMock = vi.fn(async (path: string) => ({
      ok: true,
      text: async () =>
        path === "/docs/architecture.md"
          ? "# Architecture\n\n```mermaid\ngraph TD; A-->B\n```\n"
          : "# Pitch deck\n\nThe pitch goes here.",
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the Docs control with both entries after opening the menu", async () => {
    render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: "Docs" }));
    expect(
      screen.getByRole("menuitem", { name: "Pitch deck" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Architecture" })
    ).toBeInTheDocument();
  });

  it("offers only Pitch deck and Architecture (no collab/readme)", async () => {
    render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: "Docs" }));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.textContent ?? "").not.toMatch(/collab|readme/i);
    }
  });

  it("selecting Architecture fetches and renders its inline mermaid", async () => {
    const { container } = render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: "Docs" }));
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Architecture" })
    );

    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );
    expect(fetchMock).toHaveBeenCalledWith("/docs/architecture.md");
    expect(await screen.findByText("architecture.md")).toBeInTheDocument();
  });

  it("selecting Pitch deck fetches and renders its content", async () => {
    render(<Home />);
    await userEvent.click(screen.getByRole("button", { name: "Docs" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Pitch deck" }));

    expect(await screen.findByText("The pitch goes here.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/docs/pitchdeck.md");
    expect(screen.getByText("pitchdeck.md")).toBeInTheDocument();
  });

  it("replaces already-loaded content when a doc is selected", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container, "# Existing document body");
    expect(screen.getByText("Existing document body")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Docs" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Pitch deck" }));

    expect(await screen.findByText("The pitch goes here.")).toBeInTheDocument();
    expect(
      screen.queryByText("Existing document body")
    ).not.toBeInTheDocument();
  });
});

describe("Home page — Load from GitLab", () => {
  const VALID_URL =
    "https://sgts.gitlab-dedicated.com/group/project/-/blob/main/README.md";
  const TOKEN = "glpat-secret-token-value";

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    markTourSeen();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Open the GitLab panel and fill in the URL and token inputs. */
  async function fillGitLabPanel(url: string, token: string) {
    await userEvent.click(
      screen.getByRole("button", { name: "Load from GitLab" })
    );
    const urlInput = screen.getByPlaceholderText(/sgts\.gitlab-dedicated/i);
    await userEvent.type(urlInput, url);
    const tokenInput = screen.getByLabelText(/access token/i);
    if (token) await userEvent.type(tokenInput, token);
    return { tokenInput };
  }

  it("loads a document from GitLab and preserves the download controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# From GitLab\n\nRemote body text.",
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);
    await fillGitLabPanel(VALID_URL, TOKEN);
    await userEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(await screen.findByText("Remote body text.")).toBeInTheDocument();
    // Filename derived from the file path is shown.
    expect(screen.getByText("README.md")).toBeInTheDocument();

    // Existing download controls behave as for a locally-opened file.
    expect(
      screen.getByRole("button", { name: "Download comments" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download .zip" })
    ).toBeInTheDocument();

    // fetch was called with the parsed raw API URL and the token header.
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      "https://sgts.gitlab-dedicated.com/api/v4/projects/group%2Fproject/repository/files/README.md/raw?ref=main"
    );
    expect(init).toEqual({ headers: { "PRIVATE-TOKEN": TOKEN } });
  });

  it("keeps the token out of storage and uses a password input", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "# Doc",
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<Home />);
    const { tokenInput } = await fillGitLabPanel(VALID_URL, TOKEN);
    expect(tokenInput).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Load" }));
    await screen.findByText("Doc");

    expect(JSON.stringify(localStorage)).not.toContain(TOKEN);
    expect(JSON.stringify(sessionStorage)).not.toContain(TOKEN);
  });

  it("alerts and does not fetch when the URL host is rejected", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<Home />);
    await fillGitLabPanel(
      "https://gitlab.com/group/project/-/blob/main/README.md",
      TOKEN
    );
    await userEvent.click(screen.getByRole("button", { name: "Load" }));

    expect(alertSpy).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("alerts without leaking the token and leaves state intact on 401/403", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 });
    vi.stubGlobal("fetch", fetchMock);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<Home />);
    await fillGitLabPanel(VALID_URL, TOKEN);
    await userEvent.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const message = String(alertSpy.mock.calls[0][0]);
    expect(message).toMatch(/unauthorized|rejected the token/i);
    expect(message).not.toContain(TOKEN);
    // No document was loaded.
    expect(
      screen.queryByRole("button", { name: "New comments" })
    ).not.toBeInTheDocument();
  });

  it("alerts on 404 and leaves state intact", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<Home />);
    await fillGitLabPanel(VALID_URL, TOKEN);
    await userEvent.click(screen.getByRole("button", { name: "Load" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(String(alertSpy.mock.calls[0][0])).toMatch(/not found/i);
    expect(
      screen.queryByRole("button", { name: "New comments" })
    ).not.toBeInTheDocument();
  });
});

describe("Home page — Email comments", () => {
  beforeEach(() => {
    localStorage.clear();
    markTourSeen();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Email comments button is disabled when no comments are loaded", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container);
    const btn = screen.getByRole("button", { name: "Email comments" });
    expect(btn).toBeDisabled();
  });

  it("Email comments button is enabled when comments exist", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);
    const btn = screen.getByRole("button", { name: "Email comments" });
    expect(btn).not.toBeDisabled();
  });

  it("clicking Email comments opens the panel with a To input and Send button", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);
    await userEvent.click(screen.getByRole("button", { name: "Email comments" }));
    expect(screen.getByRole("dialog", { name: "Email comments" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  it("Send button is disabled when To field is empty", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);
    await userEvent.click(screen.getByRole("button", { name: "Email comments" }));
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("Send button is disabled while request is in flight", async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);
    await userEvent.click(screen.getByRole("button", { name: "Email comments" }));
    await userEvent.type(screen.getByRole("textbox"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
  });

  it("submitting a valid email POSTs to /api/email-comments and closes the panel on success", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);
    await userEvent.click(screen.getByRole("button", { name: "Email comments" }));
    await userEvent.type(screen.getByRole("textbox"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Email comments" })).not.toBeInTheDocument()
    );
    expect(vi.mocked(global.fetch)).toHaveBeenCalledWith(
      "/api/email-comments",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"to":"test@example.com"'),
      })
    );
  });

  it("displays inline error and keeps panel open on API error", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to send email." }),
    } as Response);
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);
    await userEvent.click(screen.getByRole("button", { name: "Email comments" }));
    await userEvent.type(screen.getByRole("textbox"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Failed to send email.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Email comments" })).toBeInTheDocument();
  });

  it("clears the To field after a successful send", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    const { container } = render(<Home />);
    await loadMarkdown(container);
    await loadComments(container, ["a note"]);
    await userEvent.click(screen.getByRole("button", { name: "Email comments" }));
    await userEvent.type(screen.getByRole("textbox"), "test@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Email comments" })).not.toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: "Email comments" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });
});

const ONE_MERMAID = "# Diagram\n\n```mermaid\ngraph TD; A-->B\n```\n";
const TWO_MERMAID =
  "```mermaid\ngraph TD; A-->B\n```\n\n```mermaid\ngraph LR; C-->D\n```\n";

/** Select the raw text of the first <code> in a source-view <pre>. */
function selectSourceText(container: HTMLElement): void {
  const codes = container.querySelectorAll("article pre code");
  const code = codes[codes.length - 1] as HTMLElement;
  const textNode = code.firstChild as Text;
  const range = document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, textNode.length);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
}

describe("Home page — Mermaid", () => {
  beforeEach(() => {
    localStorage.clear();
    markTourSeen();
    vi.mocked(renderMermaid).mockReset();
    vi.mocked(renderMermaid).mockResolvedValue(
      "<svg data-testid='mermaid-svg'></svg>"
    );
  });

  it("renders a mermaid block as a diagram SVG by default, not a raw code block", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);

    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );
    // The raw mermaid source should NOT be shown as a code block by default.
    expect(container.querySelector("article pre")).toBeNull();
  });

  it("toggles a block to source view (selectable text) and back to diagram", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    await userEvent.click(screen.getByRole("button", { name: "Show source" }));
    const code = container.querySelector("article pre code");
    expect(code?.textContent).toBe("graph TD; A-->B");

    await userEvent.click(screen.getByRole("button", { name: "Show diagram" }));
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );
  });

  it("keeps per-diagram toggle independent across two blocks", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container, TWO_MERMAID);
    await waitFor(() =>
      expect(container.querySelectorAll(".md-mermaid-diagram svg")).toHaveLength(2)
    );

    // Toggle only the first block to source.
    const toggles = screen.getAllByRole("button", { name: "Show source" });
    await userEvent.click(toggles[0]);

    // First block now shows source; the second is still a diagram.
    expect(container.querySelectorAll("article pre code")).toHaveLength(1);
    expect(container.querySelectorAll(".md-mermaid-diagram svg")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Show diagram" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Show source" })
    ).toHaveLength(1);
  });

  it("creates a comment anchored to the selected source text", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    await userEvent.click(screen.getByRole("button", { name: "Show source" }));
    const article = container.querySelector("article") as HTMLElement;

    // jsdom's Range lacks getBoundingClientRect; stub it so the popover anchor
    // can be computed.
    Range.prototype.getBoundingClientRect = () =>
      ({
        left: 0,
        bottom: 0,
        top: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    // Select the raw source text and fire mouseup to open the popover.
    selectSourceText(container);
    fireEvent.mouseUp(article);

    const authorInput = await screen.findByPlaceholderText(/your name/i);
    await userEvent.type(authorInput, "Ada");
    const bodyInput = screen.getByPlaceholderText(/add a comment/i);
    await userEvent.type(bodyInput, "a diagram note");
    await userEvent.click(screen.getByRole("button", { name: "Comment" }));

    // The comment is listed in the sidebar, and the source text is highlighted.
    expect(await screen.findByText("a diagram note")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        container.querySelector("article mark.md-comment-highlight")
      ).toBeTruthy()
    );
  });

  it("highlights the diagram when it carries a comment and activates on click", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    // Load a comment whose quote lies in the mermaid source.
    const json = JSON.stringify({
      version: 1,
      comments: [
        {
          id: "cm1",
          quote: "A-->B",
          occurrence: 1,
          author: "Ada",
          body: "diagram comment",
          createdAt: new Date(0).toISOString(),
          resolved: false,
        },
      ],
    });
    const input = container.querySelector(
      'input[accept*=".json"]'
    ) as HTMLInputElement;
    const file = new File([json], "comments.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText("diagram comment");

    // The diagram carries the has-comment highlight while the comment stays
    // listed in the sidebar.
    const diagram = await waitFor(() => {
      const el = container.querySelector(".md-mermaid-diagram.has-comment");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(diagram.getAttribute("data-comment-id")).toBe("cm1");

    // Clicking the highlighted diagram activates its comment.
    fireEvent.click(diagram);
    await waitFor(() =>
      expect(
        container.querySelector(".md-mermaid-diagram.has-comment.is-active")
      ).toBeTruthy()
    );
  });

  /** Load a comment JSON with a single comment, via the hidden .json input. */
  function loadMermaidComment(
    container: HTMLElement,
    overrides: Record<string, unknown> = {}
  ): void {
    const json = JSON.stringify({
      version: 1,
      comments: [
        {
          id: "cm1",
          quote: "A-->B",
          occurrence: 1,
          author: "Ada",
          body: "diagram comment",
          createdAt: new Date(0).toISOString(),
          resolved: false,
          ...overrides,
        },
      ],
    });
    const input = container.querySelector(
      'input[accept*=".json"]'
    ) as HTMLInputElement;
    const file = new File([json], "comments.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("selecting a diagram-view mermaid comment in the sidebar switches that block to source and focuses the highlight", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    loadMermaidComment(container);
    await waitFor(() =>
      expect(
        container.querySelector(".md-mermaid-diagram.has-comment")
      ).toBeTruthy()
    );

    await userEvent.click(screen.getByText("diagram comment"));

    await waitFor(() => {
      const code = container.querySelector("article pre code");
      expect(code?.textContent).toBe("graph TD; A-->B");
    });
    await waitFor(() =>
      expect(
        container.querySelector('mark.md-comment-highlight[data-comment-id="cm1"]')
      ).toBeTruthy()
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("does not auto-revert to diagram when another comment is selected or deselected", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    loadMermaidComment(container);
    await waitFor(() =>
      expect(
        container.querySelector(".md-mermaid-diagram.has-comment")
      ).toBeTruthy()
    );

    await userEvent.click(screen.getByText("diagram comment"));
    await waitFor(() =>
      expect(container.querySelector("article pre code")).toBeTruthy()
    );

    // Re-select the same comment — the block must stay in source view.
    await userEvent.click(screen.getByText("diagram comment"));
    expect(container.querySelector("article pre code")).toBeTruthy();
  });

  it("clicking the diagram does NOT switch it to source view", async () => {
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    loadMermaidComment(container);
    const diagram = await waitFor(() => {
      const el = container.querySelector(".md-mermaid-diagram.has-comment");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });

    fireEvent.click(diagram);
    await waitFor(() =>
      expect(
        container.querySelector(".md-mermaid-diagram.has-comment.is-active")
      ).toBeTruthy()
    );
    // Clicking only activates; it must not force source view.
    expect(container.querySelector("article pre")).toBeNull();
  });

  it("focuses the correct occurrence when the quote appears in both document text and a diagram", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const doc = "Prose mentions A-->B here.\n\n```mermaid\ngraph TD; A-->B\n```\n";
    const { container } = render(<Home />);
    await loadMarkdown(container, doc);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    // Occurrence 2 points at the mermaid source (occurrence 1 is the prose).
    loadMermaidComment(container, { occurrence: 2 });
    await waitFor(() =>
      expect(
        container.querySelector(".md-mermaid-diagram.has-comment")
      ).toBeTruthy()
    );

    await userEvent.click(screen.getByText("diagram comment"));
    await waitFor(() =>
      expect(container.querySelector("article pre code")).toBeTruthy()
    );
    await waitFor(() =>
      expect(
        container.querySelector('mark.md-comment-highlight[data-comment-id="cm1"]')
      ).toBeTruthy()
    );
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("a non-mermaid comment selection scrolls/flashes with no diagram view change", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const doc = "Some plain prose text.\n\n```mermaid\ngraph TD; A-->B\n```\n";
    const { container } = render(<Home />);
    await loadMarkdown(container, doc);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    loadMermaidComment(container, { quote: "plain prose", occurrence: 1 });
    await screen.findByText("diagram comment");
    await waitFor(() =>
      expect(
        container.querySelector('mark.md-comment-highlight[data-comment-id="cm1"]')
      ).toBeTruthy()
    );

    await userEvent.click(screen.getByText("diagram comment"));
    // Diagram is untouched: no source-view <pre> appears.
    expect(container.querySelector("article pre")).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("a mermaid comment whose block is already in source view focuses without an extra toggle", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(<Home />);
    await loadMarkdown(container, ONE_MERMAID);
    await waitFor(() =>
      expect(container.querySelector(".md-mermaid-diagram svg")).toBeTruthy()
    );

    loadMermaidComment(container);
    await screen.findByText("diagram comment");

    // Manually put the block in source view first.
    await userEvent.click(screen.getByRole("button", { name: "Show source" }));
    await waitFor(() =>
      expect(container.querySelectorAll("article pre code")).toHaveLength(1)
    );

    await userEvent.click(screen.getByText("diagram comment"));
    // Still exactly one source-view block (no extra toggle needed).
    expect(container.querySelectorAll("article pre code")).toHaveLength(1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
