import { describe, expect, it } from "vitest";
import { MESSAGES, validateSignup } from "./signup-validation";

const VALID_BODY = {
  name: "Ana Souza",
  email: "ana@exemplo.com.br",
  password: "senha-segura-123",
  passwordConfirmation: "senha-segura-123",
};

describe("validateSignup", () => {
  it("accepts a complete and valid signup", () => {
    expect(validateSignup(VALID_BODY)).toEqual({
      ok: true,
      input: {
        name: "Ana Souza",
        email: "ana@exemplo.com.br",
        password: "senha-segura-123",
      },
    });
  });

  it("trims the name and the email and lowercases the email", () => {
    const result = validateSignup({
      ...VALID_BODY,
      name: "  Ana Souza  ",
      email: "  Ana@Exemplo.com.br ",
    });
    expect(result).toMatchObject({
      ok: true,
      input: { name: "Ana Souza", email: "ana@exemplo.com.br" },
    });
  });

  it("accepts a password with exactly 8 characters", () => {
    const result = validateSignup({
      ...VALID_BODY,
      password: "12345678",
      passwordConfirmation: "12345678",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a password with 7 characters with a message in Portuguese", () => {
    const result = validateSignup({
      ...VALID_BODY,
      password: "1234567",
      passwordConfirmation: "1234567",
    });
    expect(result).toEqual({
      ok: false,
      errors: { password: "A senha deve ter pelo menos 8 caracteres." },
    });
  });

  it("counts password length in code points, not UTF-16 units", () => {
    // Cada emoji tem 2 unidades UTF-16: "🔐🔐🔐🔐" tem length 8 mas 4 caracteres.
    const fourEmojis = "🔐".repeat(4);
    expect(fourEmojis.length).toBe(8);
    const result = validateSignup({
      ...VALID_BODY,
      password: fourEmojis,
      passwordConfirmation: fourEmojis,
    });
    expect(result).toEqual({
      ok: false,
      errors: { password: "A senha deve ter pelo menos 8 caracteres." },
    });
  });

  it("accepts a password with 8 code points even when UTF-16 length is larger", () => {
    const eightEmojis = "🔐".repeat(8);
    expect(eightEmojis.length).toBe(16);
    expect(
      validateSignup({ ...VALID_BODY, password: eightEmojis, passwordConfirmation: eightEmojis }).ok,
    ).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = validateSignup({ ...VALID_BODY, password: "", passwordConfirmation: "" });
    expect(result).toMatchObject({ ok: false, errors: { password: MESSAGES.passwordTooShort } });
  });

  it("rejects a confirmation that differs from the password", () => {
    const result = validateSignup({ ...VALID_BODY, passwordConfirmation: "outra-senha-456" });
    expect(result).toEqual({
      ok: false,
      errors: { passwordConfirmation: "As senhas não coincidem." },
    });
  });

  it("rejects a missing confirmation", () => {
    expect(validateSignup({ ...VALID_BODY, passwordConfirmation: undefined })).toMatchObject({
      ok: false,
      errors: { passwordConfirmation: MESSAGES.passwordMismatch },
    });
  });

  it("rejects an empty or blank name", () => {
    expect(validateSignup({ ...VALID_BODY, name: "" })).toMatchObject({
      ok: false,
      errors: { name: MESSAGES.nameRequired },
    });
    expect(validateSignup({ ...VALID_BODY, name: "   " })).toMatchObject({
      ok: false,
      errors: { name: MESSAGES.nameRequired },
    });
  });

  it("accepts a name with 120 characters and rejects 121", () => {
    expect(validateSignup({ ...VALID_BODY, name: "a".repeat(120) }).ok).toBe(true);
    expect(validateSignup({ ...VALID_BODY, name: "a".repeat(121) })).toMatchObject({
      ok: false,
      errors: { name: MESSAGES.nameTooLong },
    });
  });

  it("rejects an empty email", () => {
    expect(validateSignup({ ...VALID_BODY, email: "" })).toMatchObject({
      ok: false,
      errors: { email: MESSAGES.emailRequired },
    });
  });

  it.each(["ana", "ana@exemplo", "ana exemplo@exemplo.com", "@exemplo.com.br"])(
    "rejects the malformed email %s",
    (email) => {
      expect(validateSignup({ ...VALID_BODY, email })).toMatchObject({
        ok: false,
        errors: { email: MESSAGES.emailInvalid },
      });
    },
  );

  it("rejects an email longer than 255 characters", () => {
    const email = `${"a".repeat(250)}@x.com`;
    expect(validateSignup({ ...VALID_BODY, email })).toMatchObject({
      ok: false,
      errors: { email: MESSAGES.emailInvalid },
    });
  });

  it("reports every invalid field at once", () => {
    const result = validateSignup({ name: "", email: "x", password: "curta" });
    expect(result).toEqual({
      ok: false,
      errors: {
        name: MESSAGES.nameRequired,
        email: MESSAGES.emailInvalid,
        password: MESSAGES.passwordTooShort,
        passwordConfirmation: MESSAGES.passwordMismatch,
      },
    });
  });

  it.each([undefined, null, "texto", 42, [], ["ana"]])(
    "reports name, email and password as missing when the body is %j",
    (body) => {
      expect(validateSignup(body)).toEqual({
        ok: false,
        errors: {
          name: MESSAGES.nameRequired,
          email: MESSAGES.emailRequired,
          password: MESSAGES.passwordTooShort,
        },
      });
    },
  );

  it("reports a missing confirmation when the password was given", () => {
    expect(validateSignup({ ...VALID_BODY, passwordConfirmation: undefined })).toEqual({
      ok: false,
      errors: { passwordConfirmation: MESSAGES.passwordMismatch },
    });
  });

  it("ignores non-string values as if they were missing", () => {
    expect(validateSignup({ ...VALID_BODY, name: 123 })).toMatchObject({
      ok: false,
      errors: { name: MESSAGES.nameRequired },
    });
  });
});
