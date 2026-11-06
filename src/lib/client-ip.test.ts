import { describe, expect, it } from "vitest";
import { readClientIp, readTrustedProxyCount } from "./client-ip";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/signup", { method: "POST", headers });
}

describe("readClientIp", () => {
  it("uses the hop appended by the single trusted proxy", () => {
    const request = requestWith({ "x-forwarded-for": "10.0.0.1, 198.51.100.7" });

    expect(readClientIp(request, 1)).toBe("198.51.100.7");
  });

  it("ignores client-supplied values placed before the trusted hop", () => {
    const request = requestWith({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" });

    expect(readClientIp(request, 1)).toBe("198.51.100.7");
  });

  it("skips as many hops as there are trusted proxies", () => {
    const request = requestWith({ "x-forwarded-for": "9.9.9.9, 198.51.100.7, 10.0.0.2" });

    expect(readClientIp(request, 2)).toBe("198.51.100.7");
  });

  it("returns null when there are no trusted proxies, so headers are not trusted", () => {
    const request = requestWith({ "x-forwarded-for": "1.2.3.4" });

    expect(readClientIp(request, 0)).toBeNull();
  });

  it("ignores x-real-ip, which the client can set freely", () => {
    const request = requestWith({ "x-real-ip": "203.0.113.9" });

    expect(readClientIp(request, 1)).toBeNull();
  });

  it("returns null when there is no x-forwarded-for header", () => {
    expect(readClientIp(requestWith({}), 1)).toBeNull();
  });

  it("returns null when there are fewer hops than trusted proxies", () => {
    const request = requestWith({ "x-forwarded-for": "198.51.100.7" });

    expect(readClientIp(request, 2)).toBeNull();
  });

  it("returns null for an empty x-forwarded-for header", () => {
    expect(readClientIp(requestWith({ "x-forwarded-for": " , " }), 1)).toBeNull();
  });
});

describe("readTrustedProxyCount", () => {
  it("defaults to zero when the variable is not set", () => {
    expect(readTrustedProxyCount({})).toBe(0);
  });

  it("reads a non-negative integer", () => {
    expect(readTrustedProxyCount({ TRUSTED_PROXY_COUNT: " 2 " })).toBe(2);
  });

  it("treats invalid values as zero", () => {
    expect(readTrustedProxyCount({ TRUSTED_PROXY_COUNT: "abc" })).toBe(0);
    expect(readTrustedProxyCount({ TRUSTED_PROXY_COUNT: "-1" })).toBe(0);
    expect(readTrustedProxyCount({ TRUSTED_PROXY_COUNT: "1.5" })).toBe(0);
  });
});
