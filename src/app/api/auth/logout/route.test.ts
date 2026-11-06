import { beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set })),
}));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    set.mockClear();
  });

  it("responde 204 sem corpo", async () => {
    const response = await POST();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("zera o cookie de sessão", async () => {
    await POST();

    expect(set).toHaveBeenCalledTimes(1);
    const [name, value, options] = set.mock.calls[0];
    expect(name).toBe("session");
    expect(value).toBe("");
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  });
});
