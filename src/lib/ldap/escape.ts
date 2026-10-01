/**
 * Escapa um valor para uso seguro dentro de um filtro LDAP (RFC 4515 §3).
 * Impede LDAP injection: `*`, `(`, `)`, `\` e NUL viram sequências \XX.
 */
export function escapeFilterValue(value: string): string {
  let out = "";
  for (const ch of value) {
    switch (ch) {
      case "\\":
        out += "\\5c";
        break;
      case "*":
        out += "\\2a";
        break;
      case "(":
        out += "\\28";
        break;
      case ")":
        out += "\\29";
        break;
      case "\0":
        out += "\\00";
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/** Monta o filtro final: filtro de usuários ativos + atributo de login = valor escapado. */
export function buildUserSearchFilter(userFilter: string, loginAttribute: string, username: string): string {
  return `(&${userFilter}(${loginAttribute}=${escapeFilterValue(username)}))`;
}
