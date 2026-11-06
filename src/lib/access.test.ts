import { describe, expect, it } from "vitest";
import { decideAccess } from "./access";

describe("decideAccess", () => {
  it("redireciona rotas do aplicativo sem sessão", () => {
    expect(decideAccess("/", false)).toBe("redirect-to-sign-in");
    expect(decideAccess("/dividas", false)).toBe("redirect-to-sign-in");
  });

  it("permite rotas do aplicativo com sessão", () => {
    expect(decideAccess("/", true)).toBe("allow");
    expect(decideAccess("/dividas", true)).toBe("allow");
  });

  it("sempre permite a tela Entrar e as rotas de autenticação", () => {
    expect(decideAccess("/entrar", false)).toBe("allow");
    expect(decideAccess("/api/auth/logout", false)).toBe("allow");
  });
});
