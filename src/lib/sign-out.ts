export const LOGOUT_PATH = "/api/auth/logout";

type FetchLike = (input: string, init: { method: string }) => Promise<{ ok: boolean }>;

/** Chama POST /api/auth/logout. Retorna true se a sessão foi encerrada. */
export async function requestSignOut(fetchFn: FetchLike = fetch): Promise<boolean> {
  try {
    const response = await fetchFn(LOGOUT_PATH, { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}
