// Clears a stale session (valid JWT whose user no longer exists) and sends
// the browser to /login. Cookies can only be modified in a route handler or
// server action — pages redirect here when they detect the stale state.

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  (await cookies()).delete(SESSION_COOKIE);
  return NextResponse.redirect(new URL("/login", req.url));
}
