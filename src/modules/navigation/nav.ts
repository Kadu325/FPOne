import type { Permission } from "@/server/authz/permissions";
import { ADMIN_NAME, HOME_NAME } from "@/lib/constants";

/** Ícones lucide usados na navegação, mapeados em components/layout/NavIcon. */
export type NavIconName =
  | "house"
  | "megaphone"
  | "sparkles"
  | "cake-slice"
  | "user-round"
  | "users-round"
  | "calendar-days"
  | "book-open"
  | "link-2"
  | "search"
  | "chart"
  | "settings";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: NavIconName;
  /** null = todo usuário autenticado. A checagem real é sempre no servidor (RN-CORE-001). */
  permission: Permission | null;
  /** Módulo ainda não entregue: aparece como "Em breve", sem link (nada de rota morta). */
  ready: boolean;
}

export interface NavSection {
  id: string;
  /** null = sem título de grupo (Meu FPOne). */
  label: string | null;
  items: NavItem[];
}

/** Menu oficial MVP 1.3 (§87, §109) + Novidades em Comunicação (§183). Única fonte da navegação. */
export const NAVIGATION: readonly NavSection[] = [
  { id: "home", label: null, items: [{ id: "inicio", label: HOME_NAME, href: "/", icon: "house", permission: null, ready: true }] },
  {
    id: "comunicacao",
    label: "Comunicação",
    items: [
      { id: "comunicados", label: "Comunicados", href: "/comunicados", icon: "megaphone", permission: null, ready: true },
      { id: "novidades", label: "Novidades", href: "/novidades", icon: "sparkles", permission: null, ready: true },
    ],
  },
  {
    id: "pessoas",
    label: "Pessoas",
    items: [
      { id: "aniversariantes", label: "Aniversariantes", href: "/aniversariantes", icon: "cake-slice", permission: null, ready: true },
      { id: "perfil", label: "Meu Perfil", href: "/perfil", icon: "user-round", permission: null, ready: true },
      { id: "colaboradores", label: "Colaboradores", href: "/pessoas", icon: "users-round", permission: null, ready: true },
    ],
  },
  {
    id: "organizacao",
    label: "Organização",
    items: [
      { id: "agenda", label: "Agenda / Eventos", href: "/agenda", icon: "calendar-days", permission: null, ready: true },
      { id: "documentos", label: "Documentos", href: "/documentos", icon: "book-open", permission: null, ready: true },
      { id: "links", label: "Links úteis", href: "/links", icon: "link-2", permission: null, ready: true },
    ],
  },
  {
    id: "inteligencia",
    label: "Inteligência",
    items: [
      { id: "busca", label: "Busca Global", href: "/busca", icon: "search", permission: null, ready: true },
      { id: "indicadores", label: "Indicadores", href: "/indicadores", icon: "chart", permission: "analytics.read", ready: true },
    ],
  },
  {
    id: "administracao",
    label: "Administração",
    items: [{ id: "admin", label: ADMIN_NAME, href: "/admin", icon: "settings", permission: "admin.access", ready: true }],
  },
];

/** Navegação contextual do FPOne Admin (§91, §116). Só o que já existe. */
export const ADMIN_NAVIGATION: readonly NavItem[] = [
  { id: "admin-publicacoes", label: "Publicações", href: "/admin/publicacoes", icon: "megaphone", permission: "publication.create", ready: true },
  { id: "admin-documentos", label: "Documentos", href: "/admin/documentos", icon: "book-open", permission: "document.manage", ready: true },
  { id: "admin-agenda", label: "Agenda", href: "/admin/agenda", icon: "calendar-days", permission: "event.manage", ready: true },
  { id: "admin-links", label: "Links úteis", href: "/admin/links", icon: "link-2", permission: "link.manage", ready: true },
  { id: "admin-auditoria", label: "Auditoria", href: "/admin/auditoria", icon: "settings", permission: "audit.read", ready: true },
  { id: "admin-colaboradores", label: "Colaboradores", href: "/admin/colaboradores", icon: "users-round", permission: "admin.access", ready: true },
];

/** Barra inferior mobile (§185): Início, Comunicados, Pessoas, Buscar. */
export const BOTTOM_NAV_IDS = ["inicio", "comunicados", "colaboradores", "busca"] as const;
export const BOTTOM_NAV_LABELS: Record<(typeof BOTTOM_NAV_IDS)[number], string> = {
  inicio: "Início",
  comunicados: "Comunicados",
  colaboradores: "Pessoas",
  busca: "Buscar",
};

/** Remove itens sem permissão e seções vazias. Recebe o resultado de can() já calculado no servidor. */
export function visibleNavigation(allowed: (permission: Permission) => boolean, sections: readonly NavSection[] = NAVIGATION): NavSection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.permission === null || allowed(i.permission)) }))
    .filter((s) => s.items.length > 0);
}

/** Item ativo: rota exata para "/", prefixo de segmento para as demais. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavItem(id: string, sections: readonly NavSection[]): NavItem | undefined {
  return sections.flatMap((s) => s.items).find((i) => i.id === id);
}

/** Título da página para a topbar (contexto, §89). */
export function currentPageLabel(pathname: string, sections: readonly NavSection[]): string {
  const items = [...ADMIN_NAVIGATION, ...sections.flatMap((s) => s.items)];
  const match = items.filter((i) => i.ready && isActive(i.href, pathname)).sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? HOME_NAME;
}
