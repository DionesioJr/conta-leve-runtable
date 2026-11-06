import { NextResponse } from "next/server";

import { findUserByEmail } from "../../../../db/user-repository";
import { login } from "../../../../lib/auth/login";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/auth/session";

export const runtime = "nodejs";

const UNAVAILABLE_MESSAGE = "Serviço indisponível. Tente novamente mais tarde.";

const MAX_BODY_BYTES = 4096;

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return null;
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return null;
  }
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function unavailable() {
  return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 500 });
}

export async function POST(request: Request) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return unavailable();
  }

  const body = await readJsonBody(request);

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
