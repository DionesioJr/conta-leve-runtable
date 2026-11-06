import { describe, expect, it, vi } from "vitest";
import { signUp, type SignupDependencies } from "./signup";

const VALID_BODY = {
  name: "Ana Souza",
  email: "ana@exemplo.com.br",
  password: "senha-segura-123",
  passwordConfirmation: "senha-segura-123",
};

const FAKE_HASH = "scrypt$131072$8$1$c2FsdA==$a2V5";

function makeDependencies(
  insertUser: SignupDependencies["insertUser"] = async () => ({ ok: true, id: 7 }),
  registerAttempt: SignupDependencies["registerAttempt"] = () => ({ allowed: true }),
) {
  return {
    hashPassword: vi.fn(async () => FAKE_HASH),
    insertUser: vi.fn(insertUser),
    registerAttempt: vi.fn(registerAttempt),
  };
}

describe("signUp", () => {
  it("creates the user with the hashed password and returns it without the hash", async () => {
    const dependencies = makeDependencies();
    const outcome = await signUp(VALID_BODY, dependencies);

    expect(dependencies.hashPassword).toHaveBeenCalledWith("senha-segura-123");
    expect(dependencies.insertUser).toHaveBeenCalledWith({
      name: "Ana Souza",
      email: "ana@exemplo.com.br",
      passwordHash: FAKE_HASH,
    });
    expect(outcome).toEqual({
      ok: true,
      user: { id: 7, name: "Ana Souza", email: "ana@exemplo.com.br" },
    });
  });

  it("passes only the hash, never the plain password, to the repository", async () => {
    const dependencies = makeDependencies();
    await signUp(VALID_BODY, dependencies);

    const [saved] = dependencies.insertUser.mock.calls[0];
    expect(saved).not.toHaveProperty("password");
    expect(JSON.stringify(saved)).not.toContain("senha-segura-123");
  });

  it("returns the email error and does not report success when the email is already registered", async () => {
    const dependencies = makeDependencies(async () => ({ ok: false, reason: "email_taken" }));
    const outcome = await signUp(VALID_BODY, dependencies);

    expect(outcome).toEqual({
      ok: false,
      errors: { email: "Já existe uma conta com este e-mail." },
    });
  });

  it("does not hash or store anything when the input is invalid", async () => {
    const dependencies = makeDependencies();
    const outcome = await signUp(
      { ...VALID_BODY, password: "curta", passwordConfirmation: "curta" },
      dependencies,
    );

    expect(outcome).toEqual({
      ok: false,
      errors: { password: "A senha deve ter pelo menos 8 caracteres." },
    });
    expect(dependencies.hashPassword).not.toHaveBeenCalled();
    expect(dependencies.insertUser).not.toHaveBeenCalled();
  });

  it("propagates unexpected repository failures to the caller", async () => {
    const failure = new Error("connection lost");
    const dependencies = makeDependencies(async () => {
      throw failure;
    });

    await expect(signUp(VALID_BODY, dependencies)).rejects.toBe(failure);
  });

  it("counts an attempt only after the body is valid", async () => {
    const dependencies = makeDependencies();
    await signUp({ ...VALID_BODY, email: "sem-arroba" }, dependencies);
    await signUp(null, dependencies);

    expect(dependencies.registerAttempt).not.toHaveBeenCalled();

    await signUp(VALID_BODY, dependencies);
    expect(dependencies.registerAttempt).toHaveBeenCalledTimes(1);
  });

  it("stops before hashing or storing when the attempt is rate limited", async () => {
    const dependencies = makeDependencies(undefined, () => ({
      allowed: false,
      retryAfterSeconds: 120,
    }));
    const outcome = await signUp(VALID_BODY, dependencies);

    expect(outcome).toEqual({ ok: false, rateLimited: true, retryAfterSeconds: 120 });
    expect(dependencies.hashPassword).not.toHaveBeenCalled();
    expect(dependencies.insertUser).not.toHaveBeenCalled();
  });
});
