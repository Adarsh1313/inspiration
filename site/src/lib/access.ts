export type AccessDecision =
  | { type: "allow" }
  | { type: "redirect-login" }
  | { type: "unauthorized" };

export type AccessInput = {
  pathname: string;
  hasSession: boolean;
  /** Token presented by the caller (header or ?token=), if any. */
  token: string | null;
  /** The configured read-only token. Unset or empty means tokens are off. */
  readToken: string | undefined;
};

const PUBLIC_PATHS = new Set(["/login", "/robots.txt", "/manifest.webmanifest", "/sw.js"]);

export function isMachineRoute(pathname: string): boolean {
  return pathname === "/llms.txt" || pathname === "/api/refs.json" || /^\/r\/[^/]+\.md$/.test(pathname);
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function decideAccess({ pathname, hasSession, token, readToken }: AccessInput): AccessDecision {
  if (PUBLIC_PATHS.has(pathname)) return { type: "allow" };
  if (hasSession) return { type: "allow" };

  if (isMachineRoute(pathname)) {
    const ok = !!readToken && !!token && safeEqual(token, readToken);
    return ok ? { type: "allow" } : { type: "unauthorized" };
  }
  if (pathname.startsWith("/api/")) return { type: "unauthorized" };
  return { type: "redirect-login" };
}
