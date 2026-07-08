// Registry of project docs bundled with the app and served as same-origin
// static assets under public/docs/. Fetching these is permitted by the strict
// CSP (connect-src 'self'), so loading them needs no CSP/nonce changes.
// Deliberately excludes collab-google-drive.md and README.md.

export type BundledDoc = {
  key: string;
  label: string;
  fileName: string;
  path: string;
};

export const BUNDLED_DOCS: readonly BundledDoc[] = [
  {
    key: "pitchdeck",
    label: "Pitch deck",
    fileName: "pitchdeck.md",
    path: "/docs/pitchdeck.md",
  },
  {
    key: "architecture",
    label: "Architecture",
    fileName: "architecture.md",
    path: "/docs/architecture.md",
  },
];

/** Fetch a bundled doc's raw markdown from its same-origin static path. */
export async function loadBundledDoc(doc: BundledDoc): Promise<string> {
  const res = await fetch(doc.path);
  if (!res.ok) {
    throw new Error(
      `Could not load ${doc.fileName} (${res.status} ${res.statusText})`
    );
  }
  return await res.text();
}
