import { CaptureError } from "./types";

function ipv4Parts(host: string): number[] | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts : null;
}

function isPrivateIpv4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

function isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  const mapped = h.match(/^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (mapped) {
    if (mapped[1]) return isBlockedIp(mapped[1]);
    const hi = parseInt(mapped[2], 16);
    const lo = parseInt(mapped[3], 16);
    return isBlockedIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith("ff");
}

/** True for any IP literal we must never fetch. Non-IP strings return false. */
export function isBlockedIp(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4) return isPrivateIpv4(v4);
  if (ip.includes(":")) return isPrivateIpv6(ip);
  return false;
}

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet"];

/** Throws CaptureError("unsafe-url") unless the URL is a plain public http(s) URL. */
export function assertPublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CaptureError("invalid-url", "That is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new CaptureError("unsafe-url", "Only http and https links are allowed.");
  if (url.username || url.password) throw new CaptureError("unsafe-url", "Links with credentials are not allowed.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new CaptureError("unsafe-url", "Unusual ports are not allowed.");

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s)) || !host.includes(".") && !host.includes(":")) {
    throw new CaptureError("unsafe-url", "That address is not public.");
  }
  if (isBlockedIp(host)) throw new CaptureError("unsafe-url", "That address is not public.");
  return url;
}

/** Resolves a hostname to its IP addresses (injected so the core stays pure). */
export type ResolveHost = (hostname: string) => Promise<string[]>;

/** Rejects hostnames that resolve to private addresses (DNS rebinding and "evil.com → 127.0.0.1"). */
export async function assertResolvesPublic(url: URL, resolve?: ResolveHost): Promise<void> {
  if (!resolve) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipv4Parts(host) || host.includes(":")) return; // literal, already checked
  const ips = await resolve(host);
  if (ips.length === 0 || ips.some(isBlockedIp)) throw new CaptureError("unsafe-url", "That address is not public.");
}
