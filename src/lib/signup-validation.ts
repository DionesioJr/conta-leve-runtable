export type SignupField = "name" | "email" | "password" | "passwordConfirmation" | "form";

export type SignupErrors = Partial<Record<SignupField, string>>;

export type SignupInput = {
  name: string;
  email: string;
  password: string;
};

export type SignupValidation =
  | { ok: true; input: SignupInput }
  | { ok: false; errors: SignupErrors };

export const NAME_MAX_LENGTH = 120;
export const EMAIL_MAX_LENGTH = 255;
export const PASSWORD_MIN_LENGTH = 8;

export const MESSAGES = {
  nameRequired: "Informe seu nome.",
  nameTooLong: `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
  emailRequired: "Informe seu e-mail.",
  emailInvalid: "Informe um e-mail válido.",
  passwordTooShort: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  passwordMismatch: "As senhas não coincidem.",
  emailTaken: "Já existe uma conta com este e-mail.",
  bodyNotJson: "O corpo da requisição deve ser JSON.",
  unexpectedError: "Não foi possível criar a conta. Tente novamente.",
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readRecord(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function readTrimmedText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readRawText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

export function validateSignup(body: unknown): SignupValidation {
  const record = readRecord(body);
  const name = readTrimmedText(record, "name");
  const email = readTrimmedText(record, "email").toLowerCase();
  const password = readRawText(record, "password");
  const passwordConfirmation = readRawText(record, "passwordConfirmation");

  const errors: SignupErrors = {};

  if (name.length === 0) {
    errors.name = MESSAGES.nameRequired;
  } else if (name.length > NAME_MAX_LENGTH) {
    errors.name = MESSAGES.nameTooLong;
  }

  if (email.length === 0) {
    errors.email = MESSAGES.emailRequired;
  } else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = MESSAGES.emailInvalid;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = MESSAGES.passwordTooShort;
  }

  if (passwordConfirmation !== password) {
    errors.passwordConfirmation = MESSAGES.passwordMismatch;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, input: { name, email, password } };
}
