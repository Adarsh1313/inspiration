import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/lib/access";
import { ALLOWED_EMAIL, SESSION_MAX_AGE } from "@/lib/env";

function presentedToken(req: NextRequest): string | null {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? req.headers.get("x-hub-token") ?? req.nextUrl.searchParams.get("token");
}

export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: { maxAge: SESSION_MAX_AGE },
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const hasSession = data.user?.email?.toLowerCase() === ALLOWED_EMAIL;

  const decision = decideAccess({
    pathname: req.nextUrl.pathname,
    hasSession,
    token: presentedToken(req),
    readToken: process.env.HUB_READ_TOKEN,
  });

  if (decision.type === "unauthorized") return new NextResponse("Unauthorized", { status: 401 });
  if (decision.type === "redirect-login") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|svg|ico|webp)$).*)"],
};
