"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NAV_TABS, SIGN_IN_PATH, isActiveTab } from "@/lib/navigation";
import { focusRing } from "@/lib/styles";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");
      router.push(SIGN_IN_PATH);
      router.refresh();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <header className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <p className="text-lg font-bold">Conta Leve</p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={pending}
          className={`rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:opacity-60 ${focusRing}`}
        >
          {pending ? "Saindo…" : "Sair"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mx-auto max-w-4xl px-4 pb-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <nav aria-label="Principal" className="mx-auto max-w-4xl px-4">
        <ul className="flex gap-2">
          {NAV_TABS.map((tab) => {
            const active = isActiveTab(pathname, tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-block border-b-2 px-3 py-2 text-sm font-medium ${
                    active
                      ? "border-blue-700 text-blue-800"
                      : "border-transparent text-slate-700 hover:text-slate-900"
                  } ${focusRing}`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
