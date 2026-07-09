// Client-side loader for Markdown hosted on the org's self-hosted GitLab.
//
// The access token is supplied by the user per-session and passed ONLY to the
// GitLab origin, in the `PRIVATE-TOKEN` header. It is never persisted to
// storage, never sent to our own origin, and never interpolated into any error
// message or log line.

export const GITLAB_HOST = "sgts.gitlab-dedicated.com";
export const GITLAB_ORIGIN = "https://sgts.gitlab-dedicated.com";

export type GitLabFileRef = {
  projectPath: string;
  ref: string;
  filePath: string;
};

const BLOB_SEGMENT = "/-/blob/";

/**
 * Parse a GitLab blob URL (host-restricted to `sgts.gitlab-dedicated.com`) into
 * its project path, ref, and file path. Throws a clear Error on any malformed,
 * off-host, or non-blob URL.
 */
export function parseGitLabBlobUrl(url: string): GitLabFileRef {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Not a valid URL.");
  }

  if (parsed.host !== GITLAB_HOST) {
    throw new Error("URL must be on sgts.gitlab-dedicated.com.");
  }

  const blobIndex = parsed.pathname.indexOf(BLOB_SEGMENT);
  if (blobIndex === -1) {
    throw new Error("URL must be a GitLab file URL containing /-/blob/.");
  }

  const projectPath = parsed.pathname.slice(0, blobIndex).replace(/^\//, "");
  const afterBlob = parsed.pathname.slice(blobIndex + BLOB_SEGMENT.length);

  if (!projectPath) {
    throw new Error("URL is missing the project path.");
  }

  const firstSlash = afterBlob.indexOf("/");
  if (firstSlash === -1) {
    throw new Error("URL is missing the file path.");
  }

  const ref = afterBlob.slice(0, firstSlash);
  const filePath = afterBlob.slice(firstSlash + 1);

  if (!ref) {
    throw new Error("URL is missing the ref (branch or tag).");
  }
  if (!filePath) {
    throw new Error("URL is missing the file path.");
  }

  return { projectPath, ref, filePath };
}

/**
 * Fetch a file's raw content from the GitLab REST API using the supplied token.
 * The token is sent only in the `PRIVATE-TOKEN` header to the GitLab origin and
 * is never included in any thrown error message.
 */
export async function fetchGitLabRawFile(
  ref: GitLabFileRef,
  token: string
): Promise<string> {
  const url = `${GITLAB_ORIGIN}/api/v4/projects/${encodeURIComponent(
    ref.projectPath
  )}/repository/files/${encodeURIComponent(ref.filePath)}/raw?ref=${encodeURIComponent(
    ref.ref
  )}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "PRIVATE-TOKEN": token } });
  } catch {
    throw new Error("Could not reach GitLab (network or CSP error).");
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("GitLab rejected the token (unauthorized or no access).");
    }
    if (res.status === 404) {
      throw new Error("File or project not found on GitLab.");
    }
    throw new Error(`GitLab request failed (${res.status}).`);
  }

  return await res.text();
}

/** Return the last `/`-separated segment of a file path (the document name). */
export function fileNameFromPath(filePath: string): string {
  const segments = filePath.split("/");
  return segments[segments.length - 1];
}
