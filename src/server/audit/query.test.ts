import { describe, expect, it } from "vitest";
import { ACTION_LABELS, actionLabel, AUDIT_ACTIONS } from "@/modules/audit/labels";
import { auditCsv, auditFilterSchema, type AuditRow } from "./query";

describe("consulta da auditoria (§168)", () => {
  it("toda ação tem nome em português", () => {
    expect(AUDIT_ACTIONS.length).toBeGreaterThan(30);
    for (const a of AUDIT_ACTIONS) expect(ACTION_LABELS[a]).toMatch(/\S/);
    expect(actionLabel("DESCONHECIDA")).toBe("DESCONHECIDA");
  });

  it("filtro ignora ação desconhecida e recusa data ou cursor malformados", () => {
    expect(auditFilterSchema.parse({ action: "DROP TABLE" }).action).toBeUndefined();
    expect(auditFilterSchema.parse({ action: "LOGIN" }).action).toBe("LOGIN");
    expect(auditFilterSchema.parse({ from: "" }).from).toBeUndefined();
    expect(auditFilterSchema.safeParse({ from: "01/10/2026" }).success).toBe(false);
    expect(auditFilterSchema.safeParse({ before: "1 OR 1=1" }).success).toBe(false);
  });

  it("CSV com ; e aspas escapadas, sem quebrar colunas", () => {
    const row: AuditRow = {
      id: "7",
      createdAt: new Date("2026-10-01T13:00:00Z"),
      action: "ROLE_CHANGED",
      actionLabel: "Perfis alterados",
      entity: "user",
      entityId: "u1",
      actor: 'Ana "Admin"',
      ip: null,
      metadata: '{"before":["EMPLOYEE"],"after":["ADMIN"]}',
    };
    const csv = auditCsv([row], () => "01/10/2026 10:00");
    const [header, line] = csv.split("\r\n");
    expect(header).toBe("id;data_hora;acao;codigo;entidade;id_entidade;autor;ip;detalhes");
    expect(line).toBe('"7";"01/10/2026 10:00";"Perfis alterados";"ROLE_CHANGED";"user";"u1";"Ana ""Admin""";"";"{""before"":[""EMPLOYEE""],""after"":[""ADMIN""]}"');
  });
});
