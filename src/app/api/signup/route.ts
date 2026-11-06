import { getPool } from "../../../db/connection";
import { insertUser } from "../../../db/user-repository";
import { hashPassword } from "../../../lib/password";
import { signUp } from "../../../lib/signup";
import { MESSAGES } from "../../../lib/signup-validation";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: { form: MESSAGES.bodyNotJson } }, { status: 400 });
  }

  try {
    const outcome = await signUp(body, {
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
