import { describe, expect, it } from "vitest";
import { clientIpFromHeaders, SIGNUP_EMAIL_POLICY, SIGNUP_IP_POLICY } from "./signup-rate-limit";

describe("clientIpFromHeaders", () => {
  it("uses the last x-forwarded-for hop, the one added by the nearest proxy", () => {
    const headers = new Headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.9" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("ignores spaces and empty hops in x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": " 10.0.0.1 ,  203.0.113.9 , " });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip when there is no x-forwarded-for", () => {
    const headers = new Headers({ "x-real-ip": " 198.51.100.7 " });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.7");
  });

  it("uses a shared unknown bucket when no client address header is present", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });

  it("uses the unknown bucket when x-forwarded-for has only empty hops", () => {
    const headers = new Headers({ "x-forwarded-for": " , " });
    expect(clientIpFromHeaders(headers)).toBe("unknown");
  });
});

describe("signup rate limit policies", () => {
  it("allows more attempts per IP than per e-mail", () => {
    expect(SIGNUP_IP_POLICY.limit).toBeGreaterThan(SIGNUP_EMAIL_POLICY.limit);
  });

  it("uses fifteen minute windows for both", () => {
    expect(SIGNUP_IP_POLICY.windowMs).toBe(15 * 60 * 1000);
    expect(SIGNUP_EMAIL_POLICY.windowMs).toBe(15 * 60 * 1000);
  });
});
