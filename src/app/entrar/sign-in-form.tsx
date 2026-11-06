"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { focusRing } from "@/lib/styles";

const inputClass = `mt-1 w-full rounded border border-slate-700 px-3 py-2 ${focusRing}`;

export function SignInForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        }),
      });
      if (!response.ok) {
        setError(
          response.status === 401
            ? "E-mail ou senha incorretos."
            : "Não foi possível entrar. Tente novamente.",
        );
        setPending(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={pending}>
      {error ? (
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <label className="block text-sm font-medium">
        E-mail
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        Senha
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={`rounded bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-900 disabled:opacity-60 ${focusRing}`}
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
