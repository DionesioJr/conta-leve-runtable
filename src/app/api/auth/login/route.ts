import { NextResponse } from "next/server";

import { findUserByEmail } from "../../../../db/user-repository";
import { login, parseLoginInput } from "../../../../lib/auth/login";
import {
  LOGIN_WINDOW_MS,
  createLoginRateLimiter,
} from "../../../../lib/auth/login-rate-limit";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "../../../../lib/auth/session";

export const runtime = "nodejs";

const UNAVAILABLE_MESSAGE = "Serviço indisponível. Tente novamente mais tarde.";

const MAX_BODY_BYTES = 4096;

const emailLimiter = createLoginRateLimiter({
  maxFailures: 5,
  windowMs: LOGIN_WINDOW_MS,
});
const ipLimiter = createLoginRateLimiter({
  maxFailures: 20,
  windowMs: LOGIN_WINDOW_MS,
});

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

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
  const email = parseLoginInput(body)?.email ?? null;
  const keys = [`ip:${clientIp(request)}`];
  if (email) {
    keys.push(`email:${email}`);
  }
  const startedAt = Date.now();
  if (
    ipLimiter.isBlocked(keys[0], startedAt) ||
    (email && emailLimiter.isBlocked(keys[1], startedAt))
  ) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em alguns minutos." },
      {
        status: 429,
        headers: { "Retry-After": String(LOGIN_WINDOW_MS / 1000) },
      },
    );
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
    ipLimiter.recordFailure(keys[0], Date.now());
    if (email) {
      emailLimiter.recordFailure(keys[1], Date.now());
    }
    return NextResponse.json(
      { error: "E-mail ou senha incorretos." },
      { status: 401 },
    );
  }

  if (email) {
    emailLimiter.reset(keys[1]);
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
