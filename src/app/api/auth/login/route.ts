import { NextResponse } from "next/server";

import { findUserByEmail } from "../../../../db/user-repository";
import { login } from "../../../../lib/auth/login";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/auth/session";

export const runtime = "nodejs";

const UNAVAILABLE_MESSAGE = "Serviço indisponível. Tente novamente mais tarde.";

function unavailable() {
  return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
}

export async function POST(request: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return unavailable();
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  let result;
  try {
    result = await login(body, {
      findUserByEmail,
      now: () => Date.now(),
      secret,
    });
  } catch (error) {
    console.error("POST /api/auth/login: falha ao validar credenciais", error);
    return unavailable();
  }

  if (result.status === 401) {
    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
