import { describe, expect, it } from "vitest";
import {
  audienceFilter,
  isInAudience,
  loadAudienceSubject,
  type AudienceSubject,
  type AudienceType,
} from "@/server/authz/audience";
import type { PrismaClient } from "@/generated/prisma/client";

type Row = { audienceType: AudienceType; audienceId: string | null };
const row = (audienceType: AudienceType, audienceId: string | null = null): Row => ({
  audienceType,
  audienceId,
});

describe("Isolamento Estrito de Audiência (RN-CORE-002, §64, §75, §182)", () => {
  const userFazendaNorteTI: AudienceSubject = {
    userId: "usr-01",
    unit: "Fazenda Norte",
    department: "Tecnologia da Informação",
    groupIds: ["grp-tecnologia"],
  };

  const userFazendaNorteRH: AudienceSubject = {
    userId: "usr-02",
    unit: "Fazenda Norte",
    department: "Recursos Humanos",
    groupIds: [],
  };

  const userFazendaSulTI: AudienceSubject = {
    userId: "usr-03",
    unit: "Fazenda Sul",
    department: "Tecnologia da Informação",
    groupIds: ["grp-tecnologia"],
  };

  const userSedeFinanceiro: AudienceSubject = {
    userId: "usr-04",
    unit: "Sede Corporativa",
    department: "Financeiro",
    groupIds: ["grp-gestao"],
  };

  describe("1. Isolamento Estrito Entre Unidades (Cross-Unit Isolation)", () => {
    const itemFazendaNorte = [row("UNIT", "Fazenda Norte")];
    const itemFazendaSul = [row("UNIT", "Fazenda Sul")];
    const itemMultiplasUnidades = [row("UNIT", "Fazenda Norte"), row("UNIT", "Sede Corporativa")];

    it("colaborador vê conteúdo da sua própria unidade", () => {
      expect(isInAudience(userFazendaNorteTI, itemFazendaNorte)).toBe(true);
      expect(isInAudience(userFazendaNorteRH, itemFazendaNorte)).toBe(true);
      expect(isInAudience(userFazendaSulTI, itemFazendaSul)).toBe(true);
    });

    it("colaborador NUNCA vê conteúdo de outra unidade", () => {
      // Fazenda Sul não pode ver item da Fazenda Norte
      expect(isInAudience(userFazendaSulTI, itemFazendaNorte)).toBe(false);
      // Sede Corporativa não pode ver item da Fazenda Norte
      expect(isInAudience(userSedeFinanceiro, itemFazendaNorte)).toBe(false);
      // Fazenda Norte não pode ver item da Fazenda Sul
      expect(isInAudience(userFazendaNorteTI, itemFazendaSul)).toBe(false);
      expect(isInAudience(userFazendaNorteRH, itemFazendaSul)).toBe(false);
    });

    it("conteúdo para múltiplas unidades é visível apenas para colaboradores daquelas unidades", () => {
      expect(isInAudience(userFazendaNorteTI, itemMultiplasUnidades)).toBe(true);
      expect(isInAudience(userSedeFinanceiro, itemMultiplasUnidades)).toBe(true);
      expect(isInAudience(userFazendaSulTI, itemMultiplasUnidades)).toBe(false);
    });
  });

  describe("2. Isolamento Estrito Entre Departamentos (Cross-Department Isolation)", () => {
    const itemTI = [row("DEPARTMENT", "Tecnologia da Informação")];
    const itemRH = [row("DEPARTMENT", "Recursos Humanos")];
    const itemFinanceiro = [row("DEPARTMENT", "Financeiro")];

    it("colaborador vê conteúdo restrito ao seu próprio departamento", () => {
      expect(isInAudience(userFazendaNorteTI, itemTI)).toBe(true);
      expect(isInAudience(userFazendaSulTI, itemTI)).toBe(true);
      expect(isInAudience(userFazendaNorteRH, itemRH)).toBe(true);
      expect(isInAudience(userSedeFinanceiro, itemFinanceiro)).toBe(true);
    });

    it("colaborador NUNCA vê conteúdo direcionado a outro departamento", () => {
      expect(isInAudience(userFazendaNorteTI, itemRH)).toBe(false);
      expect(isInAudience(userFazendaNorteTI, itemFinanceiro)).toBe(false);
      expect(isInAudience(userFazendaNorteRH, itemTI)).toBe(false);
      expect(isInAudience(userFazendaNorteRH, itemFinanceiro)).toBe(false);
      expect(isInAudience(userSedeFinanceiro, itemTI)).toBe(false);
      expect(isInAudience(userSedeFinanceiro, itemRH)).toBe(false);
    });
  });

  describe("3. Combinação Estrutural E (Unidade + Departamento)", () => {
    // Exigência conjunta: Unidade "Fazenda Norte" E Departamento "Tecnologia da Informação"
    const itemNorteTI = [
      row("UNIT", "Fazenda Norte"),
      row("DEPARTMENT", "Tecnologia da Informação"),
    ];

    it("permite acesso apenas a quem satisfaz AMBOS os critérios simultaneamente", () => {
      // Fazenda Norte + TI: atende ambos
      expect(isInAudience(userFazendaNorteTI, itemNorteTI)).toBe(true);
    });

    it("bloqueia colaborador da mesma unidade mas de departamento diferente", () => {
      // Fazenda Norte + RH: unidade bate, departamento não
      expect(isInAudience(userFazendaNorteRH, itemNorteTI)).toBe(false);
    });

    it("bloqueia colaborador do mesmo departamento mas de unidade diferente", () => {
      // Fazenda Sul + TI: departamento bate, unidade não
      expect(isInAudience(userFazendaSulTI, itemNorteTI)).toBe(false);
    });

    it("bloqueia colaborador quando nem unidade nem departamento conferem", () => {
      // Sede + Financeiro: nenhum bate
      expect(isInAudience(userSedeFinanceiro, itemNorteTI)).toBe(false);
    });
  });

  describe("4. Regras de Abrangência Geral ('ALL') e Usuário Específico ('USER')", () => {
    it("item marcado como 'ALL' é visível para qualquer colaborador ativo", () => {
      const itemAll = [row("ALL")];
      expect(isInAudience(userFazendaNorteTI, itemAll)).toBe(true);
      expect(isInAudience(userFazendaNorteRH, itemAll)).toBe(true);
      expect(isInAudience(userFazendaSulTI, itemAll)).toBe(true);
      expect(isInAudience(userSedeFinanceiro, itemAll)).toBe(true);
    });

    it("item direcionado ao 'USER' é visível exclusivamente para o usuário indicado", () => {
      const itemDirectUser = [row("USER", "usr-01")];
      expect(isInAudience(userFazendaNorteTI, itemDirectUser)).toBe(true);
      expect(isInAudience(userFazendaNorteRH, itemDirectUser)).toBe(false);
      expect(isInAudience(userFazendaSulTI, itemDirectUser)).toBe(false);
      expect(isInAudience(userSedeFinanceiro, itemDirectUser)).toBe(false);
    });

    it("direcionamento a 'USER' tem precedência mesmo se o item restringir unidade", () => {
      // Item restrito à Fazenda Sul, mas explicitamente direcionado ao usr-01 (que é da Fazenda Norte)
      const itemComUserOverride = [row("UNIT", "Fazenda Sul"), row("USER", "usr-01")];
      expect(isInAudience(userFazendaNorteTI, itemComUserOverride)).toBe(true);
      // usr-02 não é da Fazenda Sul e não é o usr-01 -> bloqueado
      expect(isInAudience(userFazendaNorteRH, itemComUserOverride)).toBe(false);
    });
  });

  describe("5. Regras para Grupos ('GROUP')", () => {
    const itemGrupoTecnologia = [row("GROUP", "grp-tecnologia")];
    const itemGrupoGestao = [row("GROUP", "grp-gestao")];

    it("permite acesso se o usuário pertence ao grupo especificado", () => {
      expect(isInAudience(userFazendaNorteTI, itemGrupoTecnologia)).toBe(true);
      expect(isInAudience(userFazendaSulTI, itemGrupoTecnologia)).toBe(true);
      expect(isInAudience(userSedeFinanceiro, itemGrupoGestao)).toBe(true);
    });

    it("bloqueia acesso se o usuário não pertence ao grupo especificado", () => {
      expect(isInAudience(userFazendaNorteRH, itemGrupoTecnologia)).toBe(false);
      expect(isInAudience(userFazendaNorteTI, itemGrupoGestao)).toBe(false);
    });
  });

  describe("6. Casos Limítrofes e Proteção Contra Vazamento (Edge Cases)", () => {
    it("item sem audiência cadastrada ([]) NUNCA é visível para ninguém", () => {
      expect(isInAudience(userFazendaNorteTI, [])).toBe(false);
      expect(isInAudience(userFazendaNorteRH, [])).toBe(false);
      expect(isInAudience(userFazendaSulTI, [])).toBe(false);
      expect(isInAudience(userSedeFinanceiro, [])).toBe(false);
    });

    it("usuário com campos vazios não tem acesso a itens estruturais", () => {
      const userSemLotacao: AudienceSubject = {
        userId: "usr-sem-lotacao",
        unit: "",
        department: "",
        groupIds: [],
      };

      expect(isInAudience(userSemLotacao, [row("UNIT", "Fazenda Norte")])).toBe(false);
      expect(isInAudience(userSemLotacao, [row("DEPARTMENT", "TI")])).toBe(false);
      expect(isInAudience(userSemLotacao, [row("ALL")])).toBe(true); // ALL continua visível
      expect(isInAudience(userSemLotacao, [row("USER", "usr-sem-lotacao")])).toBe(true);
    });
  });

  describe("7. Carregamento de Sujeito de Audiência (loadAudienceSubject)", () => {
    it("retorna null se o usuário estiver inativo no banco (nenhum conteúdo é exposto)", async () => {
      const mockPrisma = {
        user: {
          findUnique: async () => ({
            id: "u-inativo",
            employee: {
              unit: "Fazenda Norte",
              department: "Operações",
              status: "INACTIVE",
            },
          }),
        },
      } as unknown as PrismaClient;

      const subject = await loadAudienceSubject(mockPrisma, "u-inativo");
      expect(subject).toBeNull();
    });

    it("retorna null se o usuário não for encontrado", async () => {
      const mockPrisma = {
        user: {
          findUnique: async () => null,
        },
      } as unknown as PrismaClient;

      const subject = await loadAudienceSubject(mockPrisma, "u-nao-existe");
      expect(subject).toBeNull();
    });

    it("retorna AudienceSubject completo para usuário ativo", async () => {
      const mockPrisma = {
        user: {
          findUnique: async () => ({
            id: "u-ativo",
            employee: {
              unit: "Fazenda Progresso",
              department: "Agronomia",
              status: "ACTIVE",
            },
          }),
        },
      } as unknown as PrismaClient;

      const subject = await loadAudienceSubject(mockPrisma, "u-ativo");
      expect(subject).toEqual({
        userId: "u-ativo",
        unit: "Fazenda Progresso",
        department: "Agronomia",
        groupIds: [],
      });
    });
  });

  describe("8. Validação do Filtro Prisma (audienceFilter)", () => {
    it("monta query com cláusulas OR (ALL, USER) e AND para tipos estruturais", () => {
      const where = audienceFilter(userFazendaNorteTI);

      expect(where.OR).toBeDefined();
      expect(where.OR.length).toBe(3);

      // Cláusula 1: ALL
      expect(where.OR[0]).toEqual({
        audiences: { some: { audienceType: "ALL" } },
      });

      // Cláusula 2: USER específico
      expect(where.OR[1]).toEqual({
        audiences: { some: { audienceType: "USER", audienceId: "usr-01" } },
      });

      // Cláusula 3: Conjunção estrutural AND
      const structuralConj = (where.OR[2] as any).AND;
      expect(structuralConj).toBeDefined();
      expect(structuralConj.length).toBe(4); // [OR de ao menos 1 estrutural, UNIT clause, DEPARTMENT clause, GROUP clause]
    });
  });
});
