import type { PrismaClient } from "@/generated/prisma/client";

/** Tipos de público-alvo (§75). GROUP depende do cadastro de grupos (fase futura). */
export const AUDIENCE_TYPES = ["ALL", "UNIT", "DEPARTMENT", "GROUP", "USER"] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

/** Quem está consultando, do ponto de vista de audiência. Montado só no servidor. */
export interface AudienceSubject {
  userId: string;
  unit: string;
  department: string;
  groupIds: readonly string[];
}

type AudienceIdMatch = string | { in: string[] };
interface AudienceRowMatch {
  audienceType: AudienceType;
  audienceId?: AudienceIdMatch;
}
type RelationMatch = { audiences: { some: AudienceRowMatch } | { none: { audienceType: AudienceType } } };
export interface AudienceWhere {
  OR: (RelationMatch | { AND: { OR: RelationMatch[] }[] })[];
}

/** Tipos estruturais: combinam por E entre si (decisão da Fase 6). */
const STRUCTURAL = ["UNIT", "DEPARTMENT", "GROUP"] as const;

function subjectValues(subject: AudienceSubject, type: (typeof STRUCTURAL)[number]): string[] {
  if (type === "UNIT") return subject.unit ? [subject.unit] : [];
  if (type === "DEPARTMENT") return subject.department ? [subject.department] : [];
  return [...subject.groupIds];
}

/**
 * WHERE de público-alvo (RN-CORE-002, §182, §64). Toda consulta a Publication, Document, Event e
 * UsefulLink deve receber este fragmento; o teste audience-guard.test.ts falha se não receber.
 *
 * Regra de combinação (decisão da Fase 6):
 * - ALL → todos;
 * - USER → o usuário listado sempre recebe;
 * - UNIT, DEPARTMENT e GROUP → OU dentro do mesmo tipo e E entre tipos presentes.
 *   Ex.: Unidade "Fazenda Progresso" + Departamento "Almoxarifado" = só o almoxarifado daquela fazenda.
 * Tipo estrutural sem valor no cadastro do usuário não casa (unidade vazia não vê conteúdo de unidade).
 */
export function audienceFilter(subject: AudienceSubject): AudienceWhere {
  const typeClause = (type: (typeof STRUCTURAL)[number]): { OR: RelationMatch[] } => {
    const values = subjectValues(subject, type);
    const or: RelationMatch[] = [{ audiences: { none: { audienceType: type } } }];
    if (values.length > 0) or.push({ audiences: { some: { audienceType: type, audienceId: { in: values } } } });
    return { OR: or };
  };
  return {
    OR: [
      { audiences: { some: { audienceType: "ALL" } } },
      { audiences: { some: { audienceType: "USER", audienceId: subject.userId } } },
      {
        AND: [
          // Precisa ter ao menos um critério estrutural; senão só ALL/USER dão acesso.
          { OR: STRUCTURAL.map((t) => ({ audiences: { some: { audienceType: t } } })) },
          ...STRUCTURAL.map(typeClause),
        ],
      },
    ],
  };
}

/** Avaliação em memória, com a mesma regra do filtro (útil para checar um item já carregado). */
export function isInAudience(subject: AudienceSubject, audiences: readonly { audienceType: AudienceType; audienceId: string | null }[]): boolean {
  if (audiences.some((a) => a.audienceType === "ALL")) return true;
  if (audiences.some((a) => a.audienceType === "USER" && a.audienceId === subject.userId)) return true;
  const present = STRUCTURAL.filter((t) => audiences.some((a) => a.audienceType === t));
  if (present.length === 0) return false;
  return present.every((t) => {
    const values = subjectValues(subject, t);
    return audiences.some((a) => a.audienceType === t && a.audienceId !== null && values.includes(a.audienceId));
  });
}

/** Carrega unidade e departamento do usuário ativo. Sem usuário ativo, null (nada é exibido). */
export async function loadAudienceSubject(prisma: PrismaClient, userId: string): Promise<AudienceSubject | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, employee: { select: { unit: true, department: true, status: true } } },
  });
  if (!user || user.employee.status !== "ACTIVE") return null;
  return { userId: user.id, unit: user.employee.unit, department: user.employee.department, groupIds: [] };
}
