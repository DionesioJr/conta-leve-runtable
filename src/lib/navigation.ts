export type NavTab = { href: string; label: string };

export const NAV_TABS: readonly NavTab[] = [
  { href: "/", label: "Início" },
  { href: "/dividas", label: "Dívidas" },
];

export const SIGN_IN_PATH = "/entrar";

export function isActiveTab(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
