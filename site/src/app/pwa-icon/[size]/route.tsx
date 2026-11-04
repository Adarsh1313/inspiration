import { ImageResponse } from "next/og";

// Matched by the proxy's static-asset exclusion (.png), so it is reachable while logged out.
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number.parseInt((await params).size, 10);
  if (![180, 192, 512].includes(n)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#16171a", color: "#f2f2f3", fontSize: n * 0.56, fontFamily: "serif" }}>
        i
      </div>
    ),
    { width: n, height: n },
  );
}
