import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { hasValidSession } from "@/lib/auth/guard";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AppHeader } from "./app-header";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!hasValidSession(token, Date.now(), process.env.SESSION_SECRET)) {
    redirect("/entrar");
  }

  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
