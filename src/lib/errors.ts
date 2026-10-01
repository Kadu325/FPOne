/** Códigos de erro de negócio (§172). O front traduz via `errorMessage`. Login AD usa src/lib/auth/errors.ts. */
export const ERROR_MESSAGES = {
  ERR_UNAUTHORIZED: "Faça login para continuar.",
  ERR_FORBIDDEN: "Você não tem permissão para esta ação.",
  ERR_VALIDATION: "Verifique os campos destacados.",
  ERR_ADMIN_ALREADY_EXISTS: "Já existe um administrador. O bootstrap só roda uma vez.",
  ERR_INVALID_PUBLICATION_TYPE: "Tipo de publicação inválido para esta operação.",
  ERR_NOT_FOUND: "Conteúdo não encontrado ou indisponível para você.",
  ERR_INVALID_TRANSITION: "Esta mudança de status não é permitida.",
  ERR_PUBLICATION_INCOMPLETE: "Para publicar, preencha o título e o conteúdo.",
  ERR_PUBLICATION_NO_AUDIENCE: "Escolha ao menos um público-alvo válido.",
  ERR_INVALID_SCHEDULE: "Verifique as datas: o agendamento deve ser no futuro e a expiração depois da publicação.",
  ERR_PUBLICATION_NOT_EDITABLE: "Publicações arquivadas ou expiradas não podem ser editadas.",
  ERR_INVALID_EVENT_DATES: "O término do evento não pode ser anterior ao início.",
  ERR_STORAGE_UNAVAILABLE: "O armazenamento de arquivos está indisponível. Tente novamente em instantes.",
  ERR_INVALID_FILE: "Arquivo inválido.",
  ERR_DOCUMENT_WITHOUT_FILE: "Envie o arquivo antes de publicar o documento.",
  ERR_ACK_NOT_REQUIRED: "Esta publicação não pede confirmação de ciência.",
  ERR_WEAK_PIN: "PIN inválido. Digite 6 números sem sequências óbvias.",
  ERR_INVALID_CREDENTIALS: "Credenciais inválidas.",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export class BusinessError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "BusinessError";
  }
}

export function errorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? "Erro inesperado.";
}
