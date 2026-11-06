import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/access";

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
