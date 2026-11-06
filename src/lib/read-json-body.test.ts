import { describe, expect, it } from "vitest";
import { readJsonBody } from "./read-json-body";

function jsonRequest(body: string | null, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("readJsonBody", () => {
  it("parses a JSON body within the limit", async () => {
    await expect(readJsonBody(jsonRequest('{"name":"Ana"}'), 1024)).resolves.toEqual({
      ok: true,
      body: { name: "Ana" },
    });
  });

  it("accepts a body exactly at the limit", async () => {
    const body = JSON.stringify({ name: "a".repeat(10) });
    await expect(readJsonBody(jsonRequest(body), body.length)).resolves.toEqual({
      ok: true,
      body: { name: "a".repeat(10) },
    });
  });

  it("rejects a body larger than the limit without parsing it", async () => {
    const body = JSON.stringify({ name: "a".repeat(2000) });
    await expect(readJsonBody(jsonRequest(body), 1024)).resolves.toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("rejects a request that declares a larger body than the limit", async () => {
    await expect(
      readJsonBody(jsonRequest("{}", { "content-length": "999999" }), 1024),
    ).resolves.toEqual({ ok: false, reason: "too_large" });
  });

  it("reports invalid JSON", async () => {
    await expect(readJsonBody(jsonRequest("{nao-e-json"), 1024)).resolves.toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });

  it("reports an empty body as invalid JSON", async () => {
    await expect(readJsonBody(jsonRequest(null), 1024)).resolves.toEqual({
      ok: false,
      reason: "invalid_json",
    });
    await expect(readJsonBody(jsonRequest(""), 1024)).resolves.toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });
});
