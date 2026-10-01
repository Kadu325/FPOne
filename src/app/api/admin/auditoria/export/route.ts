import { NextResponse, type NextRequest } from "next/server";
import { formatDateTime } from "@/modules/documents/format";
import { audit } from "@/server/audit/audit";
import { auditCsv, auditFilterSchema, exportAudit } from "@/server/audit/query";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Exporta a trilha filtrada (até 10.000 linhas) em CSV. A própria exportação fica auditada. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl));
  if (!can(user, "audit.read")) return new NextResponse("Acesso não permitido.", { status: 403 });
  const parsed = auditFilterSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return new NextResponse("Filtro inválido.", { status: 400 });
  // Exporta o filtro inteiro, sem o cursor de paginação da tela.
  const filter = { ...parsed.data, before: undefined };
  const rows = await exportAudit(db(), user, filter);
  await audit(db(), {
    actorId: user.id,
    action: "AUDIT_EXPORTED",
    entity: "audit_log",
    metadata: { rows: rows.length, action: filter.action ?? null, entity: filter.entity ?? null, from: filter.from ?? null, to: filter.to ?? null, byPerson: Boolean(filter.person) },
    ip: clientIp(req.headers),
  });
  const csv = `﻿${auditCsv(rows, formatDateTime)}`;
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
