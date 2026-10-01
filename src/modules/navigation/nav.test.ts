import { describe, expect, it } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { can } from "@/server/authz/can";
import { ADMIN_NAVIGATION, BOTTOM_NAV_IDS, NAVIGATION, currentPageLabel, findNavItem, isActive, visibleNavigation } from "./nav";

const as = (...roles: Role[]) => visibleNavigation((p) => can({ id: "u", roles }, p));
const labels = (sections: ReturnType<typeof as>) => sections.flatMap((s) => s.items.map((i) => i.label));

describe("menu oficial MVP 1.3 (§87, §109, §183)", () => {
  it("segue a ordem oficial", () => {
    expect(labels(as("ADMIN"))).toEqual([
      "Meu FPOne",
      "Comunicados",
      "Novidades",
      "Aniversariantes",
      "Meu Perfil",
      "Colaboradores",
      "Agenda / Eventos",
      "Documentos",
      "Links úteis",
      "Busca Global",
      "Indicadores",
      "FPOne Admin",
    ]);
    expect(NAVIGATION.map((s) => s.label)).toEqual([null, "Comunicação", "Pessoas", "Organização", "Inteligência", "Administração"]);
  });

  it("não expõe recursos internos como item (§110)", () => {
    for (const forbidden of ["Início", "Banners", "Notificações", "Interações", "Segmentação", "Projetos"]) {
      expect(labels(as("ADMIN"))).not.toContain(forbidden);
    }
  });

  it("FPOne Admin só aparece com admin.access (§86, §91)", () => {
    expect(labels(as("EMPLOYEE"))).not.toContain("FPOne Admin");
    expect(labels(as("MANAGER"))).not.toContain("FPOne Admin");
    expect(as("EMPLOYEE").map((s) => s.label)).not.toContain("Administração");
    expect(labels(as("HR_MANAGER"))).toContain("FPOne Admin");
    expect(labels(as("COMMUNICATION_MANAGER"))).toContain("FPOne Admin");
  });

  it("sem sessão, nada exige permissão além dos itens abertos", () => {
    expect(labels(visibleNavigation(() => false))).not.toContain("FPOne Admin");
  });

  it("ids e rotas são únicos", () => {
    const items = [...NAVIGATION.flatMap((s) => s.items), ...ADMIN_NAVIGATION];
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
  });

  it("barra inferior aponta para itens existentes", () => {
    for (const id of BOTTOM_NAV_IDS) expect(findNavItem(id, NAVIGATION)).toBeDefined();
  });
});

describe("item ativo e contexto", () => {
  it("isActive", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/admin")).toBe(false);
    expect(isActive("/admin", "/admin/colaboradores")).toBe(true);
    expect(isActive("/admin", "/administrativo")).toBe(false);
  });

  it("currentPageLabel escolhe o item mais específico", () => {
    expect(currentPageLabel("/", NAVIGATION)).toBe("Meu FPOne");
    expect(currentPageLabel("/admin", NAVIGATION)).toBe("FPOne Admin");
    expect(currentPageLabel("/admin/colaboradores", NAVIGATION)).toBe("Colaboradores");
  });
});
