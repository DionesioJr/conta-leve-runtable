import { describe, expect, it } from "vitest";
import { UNKNOWN_CLIENT_KEY, readClientIp } from "./client-ip";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/signup", { method: "POST", headers });
}

describe("readClientIp", () => {
  it("uses the last hop of x-forwarded-for, the one appended by the trusted proxy", () => {
    const request = requestWith({ "x-forwarded-for": "10.0.0.1, 198.51.100.7" });

    expect(readClientIp(request)).toBe("198.51.100.7");
  });

  it("ignores client-supplied values placed before the proxy hop", () => {
    const request = requestWith({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" });

    expect(readClientIp(request)).not.toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = requestWith({ "x-real-ip": " 203.0.113.9 " });

    expect(readClientIp(request)).toBe("203.0.113.9");
  });

  it("falls back to a shared key when no client address header exists", () => {
    expect(readClientIp(requestWith({}))).toBe(UNKNOWN_CLIENT_KEY);
  });

  it("ignores an empty x-forwarded-for header", () => {
    const request = requestWith({ "x-forwarded-for": " , " , "x-real-ip": "203.0.113.9" });

    expect(readClientIp(request)).toBe("203.0.113.9");
  });
});
