import type { AuditAction } from "@/server/audit/audit";

/** Nomes das ações da trilha (§19) em português, para a tela e o CSV de auditoria. */
export const ACTION_LABELS: Record<AuditAction, string> = {
  LOGIN: "Login",
  LOGOUT: "Logout",
  LOGIN_FAILED: "Login recusado",
  LOGIN_LOCKED: "Matrícula bloqueada",
  USER_PROVISIONED: "Usuário criado no 1º login (AD)",
  FIRST_ACCESS_VERIFIED: "Primeiro acesso verificado",
  PIN_CREATED: "PIN criado",
  PIN_RESET: "PIN redefinido",
  IMPORT_EMPLOYEES: "Carga CSV de colaboradores",
  USER_DEACTIVATED: "Colaborador inativado",
  USER_REACTIVATED: "Colaborador reativado",
  ROLE_CHANGED: "Perfis alterados",
  ADMIN_BOOTSTRAP: "Primeiro administrador",
  PUBLICATION_CREATED: "Publicação criada",
  PUBLICATION_UPDATED: "Publicação editada",
  PUBLICATION_PUBLISHED: "Publicação publicada",
  PUBLICATION_SCHEDULED: "Publicação agendada",
  PUBLICATION_UNSCHEDULED: "Agendamento cancelado",
  PUBLICATION_ARCHIVED: "Publicação arquivada",
  PUBLICATION_DELETED: "Rascunho de publicação excluído",
  PUBLICATION_ACKNOWLEDGED: "Ciência confirmada",
  CATEGORY_CREATED: "Categoria criada",
  EMPLOYEE_CONTACT_UPDATED: "Contato corporativo alterado",
  RESPONSIBILITIES_UPDATED: "Responsabilidades alteradas",
  LINK_SAVED: "Link útil salvo",
  LINK_DELETED: "Link útil excluído",
  EVENT_SAVED: "Evento salvo",
  EVENT_PUBLISHED: "Evento publicado",
  EVENT_CANCELLED: "Evento cancelado",
  EVENT_DELETED: "Rascunho de evento excluído",
  DOCUMENT_SAVED: "Documento salvo",
  DOCUMENT_VERSION_UPLOADED: "Versão de documento enviada",
  DOCUMENT_PUBLISHED: "Documento publicado",
  DOCUMENT_ARCHIVED: "Documento arquivado",
  DOCUMENT_DELETED: "Rascunho de documento excluído",
  DOCUMENT_DOWNLOADED: "Documento baixado",
  AUDIT_EXPORTED: "Auditoria exportada",
};

export const AUDIT_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];

export function actionLabel(action: string): string {
  return (ACTION_LABELS as Record<string, string>)[action] ?? action;
}
