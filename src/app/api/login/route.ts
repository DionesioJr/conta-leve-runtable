import { NextResponse } from "next/server";
import { findUserByEmail } from "../../../db/user-repository";
import { authenticateUser, type AuthenticatedUser, type Credentials } from "../../../lib/login";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  isValidSessionSecret,
} from "../../../lib/session";

export const runtime = "nodejs";

const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 1024;

function parseCredentials(body: unknown): Credentials | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const { email, password } = body as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }
  if (email.trim() === "" || email.length > MAX_EMAIL_LENGTH) {
    return null;
  }
  if (password === "" || password.length > MAX_PASSWORD_LENGTH) {
    return null;
  }
  return { email, password };
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const credentials = parseCredentials(await readJsonBody(request));
  if (!credentials) {
    return NextResponse.json({ error: "Informe e-mail e senha válidos." }, { status: 400 });
  }

  const secret = process.env.SESSION_SECRET ?? "";
  if (!isValidSessionSecret(secret)) {
    return NextResponse.json(
      { error: "Configuração de sessão ausente no servidor." },
      { status: 500 },
    );
  }

  let user: AuthenticatedUser | null;
  try {
    user = await authenticateUser(credentials, findUserByEmail);
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir o login." }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }

  const token = createSessionToken(user.id, secret, Math.floor(Date.now() / 1000));
  const response = NextResponse.json({ user }, { status: 200 });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
