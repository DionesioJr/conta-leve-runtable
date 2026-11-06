import { getPool } from "../../../db/connection";
import { registerSignupAttempt } from "../../../db/signup-attempt-repository";
import { insertUser } from "../../../db/user-repository";
import { hashPassword } from "../../../lib/password";
import { consumeRateLimit, type RateLimitStore } from "../../../lib/rate-limit";
import { MAX_JSON_BODY_BYTES, readJsonBody } from "../../../lib/read-json-body";
import { signUp } from "../../../lib/signup";
import {
  clientIpFromHeaders,
  SIGNUP_EMAIL_POLICY,
  SIGNUP_EMAIL_SCOPE,
  SIGNUP_IP_POLICY,
  SIGNUP_IP_SCOPE,
} from "../../../lib/signup-rate-limit";
import { MESSAGES, readNormalizedEmail } from "../../../lib/signup-validation";

const rateLimitStore: RateLimitStore = {
  registerAttempt: (attempt) => registerSignupAttempt(getPool(), attempt),
};

function tooManyAttempts(retryAfterSeconds: number): Response {
  return Response.json(
    { errors: { form: MESSAGES.rateLimited } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ipDecision = await consumeRateLimit(
      rateLimitStore,
      SIGNUP_IP_SCOPE,
      clientIpFromHeaders(request.headers),
      SIGNUP_IP_POLICY,
      Date.now(),
    );
    if (!ipDecision.allowed) {
      return tooManyAttempts(ipDecision.retryAfterSeconds);
    }

    const parsed = await readJsonBody(request, MAX_JSON_BODY_BYTES);
    if (!parsed.ok) {
      if (parsed.reason === "too_large") {
        return Response.json({ errors: { form: MESSAGES.bodyTooLarge } }, { status: 413 });
      }
      return Response.json({ errors: { form: MESSAGES.bodyNotJson } }, { status: 400 });
    }

    const email = readNormalizedEmail(parsed.body);
    if (email.length > 0) {
      const emailDecision = await consumeRateLimit(
        rateLimitStore,
        SIGNUP_EMAIL_SCOPE,
        email,
        SIGNUP_EMAIL_POLICY,
        Date.now(),
      );
      if (!emailDecision.allowed) {
        return tooManyAttempts(emailDecision.retryAfterSeconds);
      }
    }

    const outcome = await signUp(parsed.body, {
      hashPassword,
      insertUser: (user) => insertUser(getPool(), user),
    });

    if (!outcome.ok) {
      return Response.json({ errors: outcome.errors }, { status: 400 });
    }

    return Response.json({ user: outcome.user }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar conta", error);
    return Response.json({ errors: { form: MESSAGES.unexpectedError } }, { status: 500 });
  }
}
