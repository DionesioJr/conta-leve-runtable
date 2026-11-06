import { getPool } from "../../../db/connection";
import { insertUser } from "../../../db/user-repository";
import { hashPassword } from "../../../lib/password";
import { readClientIp } from "../../../lib/client-ip";
import { signupAttemptLimiter } from "../../../lib/signup-attempt-limiter";
import { MAX_JSON_BODY_BYTES, readJsonBody } from "../../../lib/read-json-body";
import { signUp } from "../../../lib/signup";
import { MESSAGES } from "../../../lib/signup-validation";

export async function POST(request: Request): Promise<Response> {
  try {
    const parsed = await readJsonBody(request, MAX_JSON_BODY_BYTES);
    if (!parsed.ok) {
      if (parsed.reason === "too_large") {
        return Response.json({ errors: { form: MESSAGES.bodyTooLarge } }, { status: 413 });
      }
      return Response.json({ errors: { form: MESSAGES.bodyNotJson } }, { status: 400 });
    }

    const outcome = await signUp(parsed.body, {
      hashPassword,
      insertUser: (user) => insertUser(getPool(), user),
      registerAttempt: () => {
        const clientIp = readClientIp(request);
        if (clientIp === null) {
          throw new Error("Cabeçalho x-forwarded-for ausente: IP de origem não identificado.");
        }
        return signupAttemptLimiter.consume(clientIp);
      },
    });

    if (!outcome.ok) {
      if ("rateLimited" in outcome) {
        return Response.json(
          { errors: { form: MESSAGES.rateLimited } },
          { status: 429, headers: { "Retry-After": String(outcome.retryAfterSeconds) } },
        );
      }
      return Response.json({ errors: outcome.errors }, { status: 400 });
    }

    return Response.json({ user: outcome.user }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar conta", error);
    return Response.json({ errors: { form: MESSAGES.unexpectedError } }, { status: 500 });
  }
}
