import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "ma_session";
const PUBLIC_PATHS = new Set(["/login", "/signup"]);

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-insecure-secret");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  let authenticated = false;
  if (token) {
    try {
      await jwtVerify(token, secret());
      authenticated = true;
    } catch {
      // expired / invalid token → treated as logged out
    }
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (authenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    const login = new URL("/login", request.url);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // protect all pages; skip API routes (they carry their own auth),
  // Next internals, PWA assets (icons/manifest are fetched without cookies),
  // and any file with an extension
  matcher: ["/((?!api|_next|apple-icon|icon|manifest|.*\\..*).*)"],
};
