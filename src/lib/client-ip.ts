// Cabeçalhos de IP só são confiáveis quando a aplicação roda atrás de proxy que os
// sobrescreve. TRUSTED_PROXY_COUNT indica quantos proxies confiáveis ficam na frente da
// aplicação; cada um acrescenta um hop ao x-forwarded-for. Sem a variável (ou com valor
// inválido), o cabeçalho é ignorado e o IP de origem é tratado como desconhecido.
export const TRUSTED_PROXY_COUNT_ENV = "TRUSTED_PROXY_COUNT";

export function readTrustedProxyCount(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env[TRUSTED_PROXY_COUNT_ENV]?.trim();
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

// Retorna o IP do cliente real, ou null quando não há proxy confiável suficiente para
// determiná-lo. O cabeçalho enviado pelo cliente fica antes dos hops dos proxies, então
// só o hop na posição (tamanho - proxies confiáveis) é confiável.
export function readClientIp(request: Request, trustedProxyCount: number): string | null {
  if (trustedProxyCount < 1) {
    return null;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return null;
  }

  const hops = forwardedFor
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);
  const index = hops.length - trustedProxyCount;
  if (index < 0) {
    return null;
  }
  return hops[index] ?? null;
}
