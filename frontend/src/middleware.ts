/**
 * EdgePilot AI — Route Protection Middleware
 * Blocks dashboard if not logged in, redirects to /login
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const auth = request.cookies.get("edgepilot_auth")
  const { pathname } = request.nextUrl

  // Allow login page always
  if (pathname.startsWith("/login")) {
    // If already logged in, redirect to dashboard
    if (auth) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  // Block all other pages if not logged in
  if (!auth) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
