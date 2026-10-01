/**
 * Trilha de auditoria append-only (§19, §184, RN-AUD-001/002).
 * Triggers no banco de dados impedem UPDATE/DELETE/TRUNCATE na tabela audit_log.
 */
export * from "./audit";
export { audit as recordAudit } from "./audit";
