import { cookies } from "next/headers";

const SESSION_COOKIE = "session";

export async function POST() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return new Response(null, { status: 204 });
}
