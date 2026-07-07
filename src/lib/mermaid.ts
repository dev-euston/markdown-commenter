/**
 * Client-only wrapper around the mermaid library.
 *
 * FD-3: everything mermaid does must stay in the browser — the library is
 * heavy and touches the DOM, so we `import("mermaid")` lazily inside the
 * function body (never at module top level) and only ever call it after mount.
 * This keeps mermaid out of the server bundle and out of SSR entirely.
 *
 * FD-4: the app runs under a strict `script-src 'self'` CSP. Initializing
 * mermaid with `securityLevel: "strict"` makes it sanitize its output so it
 * emits no executable inline scripts or clickable script handlers, keeping the
 * rendered SVG compatible with that CSP.
 *
 * No component imports mermaid directly — they all go through `renderMermaid`.
 */

let initialized = false;

/**
 * Render Mermaid `source` to an SVG string. Lazily loads and (once) initializes
 * mermaid on first use. Render errors propagate so callers can show a fallback.
 */
export async function renderMermaid(id: string, source: string): Promise<string> {
  const mermaid = (await import("mermaid")).default;

  if (!initialized) {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    initialized = true;
  }

  const { svg } = await mermaid.render(id, source);
  return svg;
}
