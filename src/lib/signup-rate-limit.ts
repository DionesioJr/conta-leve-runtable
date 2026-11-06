import type { RateLimitPolicy } from "./rate-limit";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export const SIGNUP_IP_SCOPE = "signup_ip";
export const SIGNUP_EMAIL_SCOPE = "signup_email";

export const SIGNUP_IP_POLICY: RateLimitPolicy = { limit: 30, windowMs: FIFTEEN_MINUTES_MS };
export const SIGNUP_EMAIL_POLICY: RateLimitPolicy = { limit: 5, windowMs: FIFTEEN_MINUTES_MS };

const UNKNOWN_CLIENT = "unknown";

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter((hop) => hop.length > 0);
    const nearestProxyView = hops[hops.length - 1];
    if (nearestProxyView) {
      return nearestProxyView;
    }
  }

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp ? realIp : UNKNOWN_CLIENT;
}
