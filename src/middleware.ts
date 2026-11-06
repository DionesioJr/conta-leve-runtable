import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, decideAccess } from "@/lib/access";
import { SIGN_IN_PATH } from "@/lib/navigation";

export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (decideAccess(request.nextUrl.pathname, hasSession) === "allow") {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
