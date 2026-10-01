/**
 * Diagnóstico da conexão com o AD (uso da equipe de TI, NÃO exposto na web).
 *
 *   npm run ldap:check                 -> testa conexão + bind da conta de serviço
 *   npm run ldap:check -- joao.silva   -> também verifica se o usuário é encontrado
 *                                         e está ativo pelo filtro configurado
 * A senha da conta de serviço nunca é impressa.
 */
import { Client } from "ldapts";
import { parseLdapConfig } from "../src/lib/ldap/config";
import { buildUserSearchFilter } from "../src/lib/ldap/escape";
import { normalizeUsername } from "../src/lib/auth/username";

async function main() {
  const cfg = parseLdapConfig(process.env);
  console.log(`Servidor: ${cfg.url} (segurança: ${cfg.security})`);
  console.log(`Base DN:  ${cfg.baseDN}`);
  console.log(`Bind DN:  ${cfg.bindDN}`);

  const client = new Client({
    url: cfg.url,
    timeout: cfg.timeoutMs,
    connectTimeout: cfg.connectTimeoutMs,
    tlsOptions: cfg.security === "ldaps" ? { rejectUnauthorized: cfg.tlsRejectUnauthorized } : undefined,
  });
  try {
    if (cfg.security === "starttls") await client.startTLS({ rejectUnauthorized: cfg.tlsRejectUnauthorized });
    await client.bind(cfg.bindDN, cfg.bindPassword);
    console.log("✔ Bind da conta de serviço OK");

    const arg = process.argv[2];
    if (arg) {
      const username = normalizeUsername(arg);
      if (!username) throw new Error("Usuário informado é inválido");
      const filter = buildUserSearchFilter(cfg.userFilter, cfg.loginAttribute, username);
      const { searchEntries } = await client.search(cfg.baseDN, {
        scope: "sub",
        filter,
        attributes: ["sAMAccountName", "displayName", "mail", "department"],
        sizeLimit: 2,
      });
      if (searchEntries.length === 1) {
        const e = searchEntries[0] as (typeof searchEntries)[number]; // length === 1
        console.log(`✔ Usuário encontrado e ATIVO: ${e.displayName} <${e.mail ?? "sem e-mail"}>`);
        console.log(`  DN: ${e.dn}`);
      } else {
        console.log(`✖ ${searchEntries.length} resultado(s) — usuário inexistente, desabilitado ou ambíguo`);
      }
    }
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error("✖ Falha:", err instanceof Error ? `${err.name}: ${err.message}` : err);
  process.exit(1);
});
