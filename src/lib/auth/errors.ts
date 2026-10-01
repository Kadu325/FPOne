/**
 * Códigos de falha de autenticação e as mensagens exibidas ao usuário.
 * As mensagens são propositalmente genéricas: não revelam se o usuário existe,
 * nem IP, porta, DN, stack trace ou códigos internos do servidor.
 */
export type AuthFailureCode =
  | "invalid_credentials"
  | "password_expired"
  | "rate_limited"
  | "service_unavailable";

export const AUTH_MESSAGES: Record<AuthFailureCode, string> = {
  invalid_credentials: "Usuário ou senha inválidos.",
  password_expired:
    "Sua senha de rede expirou ou precisa ser trocada. Procure a equipe de TI.",
  rate_limited: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.",
  service_unavailable:
    "Serviço de autenticação indisponível no momento. Tente novamente em instantes.",
};

export function messageForCode(code: string | undefined): string {
  if (code && code in AUTH_MESSAGES) return AUTH_MESSAGES[code as AuthFailureCode];
  return AUTH_MESSAGES.invalid_credentials;
}

/** Erro interno: `code` vai para a UI, `reason` apenas para o log do servidor. */
export class AdAuthError extends Error {
  readonly code: AuthFailureCode;
  readonly reason: string;

  constructor(code: AuthFailureCode, reason: string, options?: { cause?: unknown }) {
    super(code, options);
    this.name = "AdAuthError";
    this.code = code;
    this.reason = reason;
  }
}
