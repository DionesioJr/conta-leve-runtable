// Premissa de implantação: o serviço só é alcançável por um proxy que anexa o IP do cliente ao
// x-forwarded-for, sobrescrevendo o que veio do cliente. Nesse caso o último hop é confiável e
// valores enviados pelo cliente, que ficam antes dele, são ignorados. Se a aplicação for
// alcançável sem esse proxy, o cliente controla o cabeçalho inteiro e o limite por IP não vale.
export function readClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return null;
  }

  const hops = forwardedFor
    .split(",")
    .map((hop) => hop.trim())
    .filter((hop) => hop.length > 0);
  return hops[hops.length - 1] ?? null;
}
