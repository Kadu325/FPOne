/**
 * Normalização de consultas (RN-SRC-005/006, §99). Sem IA: tira acentos, caixa e as formas
 * comuns de pergunta ("quem é responsável pelo Fiscal?" → "fiscal"). Preparado para, no futuro,
 * trocar por uma camada de linguagem natural sem mudar quem chama.
 */

export const MIN_QUERY_LENGTH = 2;

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const QUESTION_PATTERNS: readonly RegExp[] = [
  /^quem (e|eh|seria) (o |a )?(responsavel|responsaveis) (pelo|pela|pelos|pelas|por|de|do|da|sobre)\s+/,
  /^quem (cuida|trata|responde) (do|da|dos|das|de|por|sobre)\s+/,
  /^quem (posso|devo|eu posso) (procurar|falar|contatar|chamar) (sobre|para|com|de|do|da)\s+/,
  /^com quem (eu )?(falo|posso falar|devo falar) (sobre|de|do|da)\s+/,
  /^(responsavel|responsaveis) (pelo|pela|por|de|do|da)\s+/,
  /^(onde (esta|fica|encontro)|como (acho|encontro)) (o |a |os |as )?/,
];

const TRAILING = /[?!.]+$/;
const LEADING_ARTICLE = /^(o|a|os|as) /;

/** Consulta pronta para comparar com texto também dobrado (sem acento, minúsculo). */
export function normalizeQuery(raw: string): string {
  let q = foldText(raw).replace(TRAILING, "").trim();
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(q)) {
      q = q.replace(pattern, "");
      break;
    }
  }
  return q.replace(LEADING_ARTICLE, "").trim().slice(0, 100);
}

/** Escapa curingas do LIKE (% _ \). */
export function likeEscape(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
