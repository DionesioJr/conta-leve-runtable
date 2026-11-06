import { describe, expect, it } from "vitest";
import { readClientIp } from "./client-ip";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/signup", { method: "POST", headers });
}

describe("readClientIp", () => {
  it("uses the last hop, appended by the platform proxy, without any configuration", () => {
    const request = requestWith({ "x-forwarded-for": "10.0.0.1, 198.51.100.7" });

    expect(readClientIp(request)).toBe("198.51.100.7");
  });

  it("ignores client-supplied values placed before the platform hop", () => {
    const request = requestWith({ "x-forwarded-for": "1.2.3.4, 198.51.100.7" });

    expect(readClientIp(request)).toBe("198.51.100.7");
  });

  it("uses the only hop when the header has a single address", () => {
    const request = requestWith({ "x-forwarded-for": "198.51.100.7" });

    expect(readClientIp(request)).toBe("198.51.100.7");
  });

  it("ignores x-real-ip, which the client can set freely", () => {
    const request = requestWith({ "x-real-ip": "203.0.113.9" });

    expect(readClientIp(request)).toBeNull();
  });

  it("returns null when there is no x-forwarded-for header", () => {
    expect(readClientIp(requestWith({}))).toBeNull();
  });

  it("returns null for an empty x-forwarded-for header", () => {
    expect(readClientIp(requestWith({ "x-forwarded-for": " , " }))).toBeNull();
  });
});
