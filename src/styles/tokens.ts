/**
 * Design tokens da FPOne Intranet (§4, §186). Única fonte das cores da marca:
 * o tailwind.config importa daqui; não repetir HEX em componentes.
 */
export const brand = {
  lime: "#86E800",
  green: "#00B63B",
  emerald: "#007F5F",
  teal: "#00B7B1",
  cyan: "#13BDEB",
  blue: "#0879C9",
  ink: "#0B2430",
} as const;

export const surface = {
  bg: "#F7FAF9",
  mist: "#F3F8F6",
  line: "#DDEAE5",
  white: "#FFFFFF",
  /** Fundo escuro da tela de login (contrato visual Login v2). Só fundo, nunca cor de texto. */
  abyss: "#061820",
} as const;

export type BrandColor = keyof typeof brand;

/**
 * Regra D6 (§186): cores da marca permitidas como texto, por fundo claro.
 * Limão, bandeira, turquesa e ciano ficam para degradês, ícones e texto sobre `ink`.
 *
 * O §186 mediu só sobre branco. Sobre `bg` (#F7FAF9) e `mist`, o azul cai para 4,36:1 e 4,26:1
 * (abaixo de AA), então azul como texto só sobre branco (cards). Ver tokens.test.ts.
 */
export const textSafeOn = {
  white: ["emerald", "blue", "ink"],
  bg: ["emerald", "ink"],
  mist: ["emerald", "ink"],
} as const satisfies Record<"white" | "bg" | "mist", readonly BrandColor[]>;

/** Cores permitidas em qualquer fundo claro do sistema. */
export const textSafeOnLight: readonly BrandColor[] = textSafeOn.bg;

export const shadow = {
  soft: "0 18px 50px rgba(6,78,59,.08)",
  card: "0 10px 30px rgba(15,23,42,.06)",
} as const;

export const gradient = {
  brand: `linear-gradient(120deg, ${brand.lime}, ${brand.green} 38%, ${brand.cyan} 76%, ${brand.blue})`,
} as const;

export const layout = {
  sidebarExpanded: "272px",
  sidebarCollapsed: "84px",
  topbarHeight: "80px",
} as const;
