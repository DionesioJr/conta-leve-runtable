import { describe, expect, it, vi } from "vitest";
import { requestSignOut } from "./sign-out";

describe("requestSignOut", () => {
  it("chama POST /api/auth/logout e retorna true quando responde ok", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true }));

    expect(await requestSignOut(fetchFn)).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("retorna false quando o servidor responde erro", async () => {
    expect(await requestSignOut(async () => ({ ok: false }))).toBe(false);
  });

  it("retorna false quando a rede falha", async () => {
    expect(
      await requestSignOut(async () => {
        throw new Error("offline");
      }),
    ).toBe(false);
  });
});
