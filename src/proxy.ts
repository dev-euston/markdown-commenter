import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Airbase enforces a strict CSP (`script-src 'self'`) on deployed apps, which
// blocks Next.js's own inline bootstrap/hydration scripts. We generate a
// per-request nonce, advertise it in the CSP, and pass it back to Next via the
// `x-nonce` request header so Next stamps the nonce onto those inline scripts.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  // Per FD-4, the production Airbase edge CSP may override this file; the edge's
  // `connect-src` allowlist must also include https://sgts.gitlab-dedicated.com
  // for the deployed direct GitLab call to work (operational follow-up).
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self' https://sgts.gitlab-dedicated.com${isDev ? " ws:" : ""};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `;
  const cspHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeaderValue);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", cspHeaderValue);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
