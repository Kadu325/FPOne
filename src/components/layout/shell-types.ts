import type { NavSection } from "@/modules/navigation/nav";

/** Dados do usuário que o AppShell exibe. Montados no servidor; nada sensível. */
export interface ShellUser {
  name: string;
  initials: string;
  roleLabel: string;
  department: string;
}

export interface ShellProps {
  user: ShellUser;
  navigation: NavSection[];
  showAdminNav: boolean;
  initialCollapsed: boolean;
  demo: boolean;
}

/** Preferência expandida/recolhida (§85). Cookie em vez de localStorage: o servidor já renderiza no estado certo, sem piscar. */
export const SIDEBAR_COOKIE = "fpone_sidebar";
