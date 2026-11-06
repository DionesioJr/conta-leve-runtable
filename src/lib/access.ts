import { SIGN_IN_PATH } from "./navigation";

export const SESSION_COOKIE = "session";

export type AccessDecision = "allow" | "redirect-to-sign-in";

export function decideAccess(pathname: string, hasSession: boolean): AccessDecision {
  if (pathname === SIGN_IN_PATH || pathname.startsWith("/api/auth/")) return "allow";
  return hasSession ? "allow" : "redirect-to-sign-in";
}
