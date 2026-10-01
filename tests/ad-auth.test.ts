/**
 * Testa o fluxo de autenticação com um AD simulado (sem rede).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { authenticateWithAD, type LdapClientLike } from "../src/lib/ldap/ad-auth";
import type { LdapConfig } from "../src/lib/ldap/config";
import { AdAuthError } from "../src/lib/auth/errors";

const FILTER =
  "(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))";

const config: LdapConfig = {
  url: "ldap://192.168.77.250:389",
  security: "none",
  baseDN: "dc=fazendaprogresso,dc=com,dc=local",
  bindDN: "FP\\glpi",
  bindPassword: "svc-pass",
  loginAttribute: "sAMAccountName",
  userFilter: FILTER,
  timeoutMs: 5000,
  connectTimeoutMs: 5000,
  tlsRejectUnauthorized: true,
};

const JOAO_DN = "CN=Joao Silva,OU=TI,DC=fazendaprogresso,DC=com,DC=local";

function ldapError(code: number, message: string) {
  return Object.assign(new Error(message), { code, name: code === 49 ? "InvalidCredentialsError" : "ResultCodeError" });
}

interface Scenario {
  entries?: Record<string, unknown>[];
  userPassword?: string;
  serviceBindError?: Error;
  searchError?: Error;
  userBindError?: Error;
}

function makeAD(s: Scenario) {
  const calls: { binds: [string, string | undefined][]; filters: string[]; bases: string[]; unbinds: number } = {
    binds: [],
    filters: [],
    bases: [],
    unbinds: 0,
  };
  const factory = (opts: { url: string }): LdapClientLike => {
    assert.equal(opts.url, config.url);
    return {
      async startTLS() {},
      async bind(dn, password) {
        calls.binds.push([dn, password]);
        if (dn === config.bindDN) {
          if (s.serviceBindError) throw s.serviceBindError;
          if (password !== config.bindPassword) throw ldapError(49, "80090308: LdapErr: DSID-0C09044E, data 52e, v4563");
          return;
        }
        if (s.userBindError) throw s.userBindError;
        if (dn === JOAO_DN && password === (s.userPassword ?? "Senha@2026")) return;
        throw ldapError(49, "80090308: LdapErr: DSID-0C09044E, comment: AcceptSecurityContext error, data 52e, v4563");
      },
      async search(base, options) {
        calls.bases.push(base);
        calls.filters.push(String(options?.filter));
        if (s.searchError) throw s.searchError;
        return { searchEntries: (s.entries ?? []) as never, searchReferences: [] };
      },
      async unbind() {
        calls.unbinds++;
      },
    };
  };
  return { factory, calls };
}

const JOAO = {
  dn: JOAO_DN,
  sAMAccountName: "joao.silva",
  displayName: "João Silva",
  mail: "joao.silva@fazendaprogresso.com.br",
  department: "TI",
  title: "Analista",
  memberOf: [
    "CN=GG_Intranet,OU=Grupos,DC=fazendaprogresso,DC=com,DC=local",
    "CN=TI\\, Suporte,OU=Grupos,DC=fazendaprogresso,DC=com,DC=local",
  ],
};

async function expectCode(p: Promise<unknown>, code: string, reason?: string) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof AdAuthError, "deve ser AdAuthError");
    assert.equal(err.code, code);
    if (reason) assert.equal(err.reason, reason);
    return true;
  });
}

test("login válido: bind de serviço -> busca com filtro -> bind do usuário", async () => {
  const { factory, calls } = makeAD({ entries: [JOAO] });
  const user = await authenticateWithAD("FP\\joao.silva", "Senha@2026", { config, clientFactory: factory });

  assert.equal(user.username, "joao.silva");
  assert.equal(user.name, "João Silva");
  assert.equal(user.department, "TI");
  assert.deepEqual(user.groups, ["GG_Intranet", "TI, Suporte"]);

  assert.deepEqual(calls.binds[0], ["FP\\glpi", "svc-pass"]);
  assert.deepEqual(calls.binds[1], [JOAO_DN, "Senha@2026"]);
  assert.equal(calls.bases[0], "dc=fazendaprogresso,dc=com,dc=local");
  assert.equal(calls.filters[0], `(&${FILTER}(sAMAccountName=joao.silva))`);
  assert.equal(calls.unbinds, 2, "as duas conexões devem ser encerradas");
});

test("senha errada => invalid_credentials", async () => {
  const { factory, calls } = makeAD({ entries: [JOAO] });
  await expectCode(authenticateWithAD("joao.silva", "errada", { config, clientFactory: factory }), "invalid_credentials", "bad_password");
  assert.equal(calls.unbinds, 2);
});

test("usuário inexistente ou DESABILITADO (filtro não retorna) => invalid_credentials", async () => {
  const { factory, calls } = makeAD({ entries: [] });
  await expectCode(authenticateWithAD("fulano", "x", { config, clientFactory: factory }), "invalid_credentials", "user_not_found_or_disabled");
  assert.equal(calls.binds.length, 1, "não tenta bind do usuário");
  assert.equal(calls.unbinds, 1);
});

test("mais de um usuário encontrado => negado", async () => {
  const { factory } = makeAD({ entries: [JOAO, { ...JOAO, dn: "CN=Outro" }] });
  await expectCode(authenticateWithAD("joao.silva", "Senha@2026", { config, clientFactory: factory }), "invalid_credentials", "ambiguous_user");
});

test("senha vazia é negada sem consultar o AD", async () => {
  const { factory, calls } = makeAD({ entries: [JOAO] });
  await expectCode(authenticateWithAD("joao.silva", "", { config, clientFactory: factory }), "invalid_credentials", "input_rejected");
  assert.equal(calls.binds.length, 0);
});

test("injeção no login é escapada no filtro", async () => {
  const { factory, calls } = makeAD({ entries: [] });
  await expectCode(authenticateWithAD("joao*", "x", { config, clientFactory: factory }), "invalid_credentials", "input_rejected");
  await expectCode(authenticateWithAD("jo'ao.silva", "x", { config, clientFactory: factory }), "invalid_credentials");
  assert.equal(calls.filters.at(-1), `(&${FILTER}(sAMAccountName=jo'ao.silva))`);
});

test("servidor fora do ar => service_unavailable (sem detalhes)", async () => {
  const err = Object.assign(new Error("connect ECONNREFUSED 192.168.77.250:389"), { code: "ECONNREFUSED" });
  const { factory } = makeAD({ serviceBindError: err });
  await assert.rejects(authenticateWithAD("joao.silva", "x", { config, clientFactory: factory }), (e: unknown) => {
    assert.ok(e instanceof AdAuthError);
    assert.equal(e.code, "service_unavailable");
    assert.equal(e.reason, "service_connect_failed");
    assert.ok(!e.message.includes("192.168"), "mensagem do erro não contém IP");
    return true;
  });
});

test("senha da conta de serviço errada => service_unavailable", async () => {
  const { factory } = makeAD({ entries: [JOAO] });
  await expectCode(
    authenticateWithAD("joao.silva", "x", { config: { ...config, bindPassword: "trocada" }, clientFactory: factory }),
    "service_unavailable",
    "service_bind_rejected",
  );
});

test("falha na busca => service_unavailable; sizeLimit => negado", async () => {
  const a = makeAD({ searchError: ldapError(1, "operationsError") });
  await expectCode(authenticateWithAD("joao.silva", "x", { config, clientFactory: a.factory }), "service_unavailable", "search_failed");
  assert.equal(a.calls.unbinds, 1);
  const b = makeAD({ searchError: ldapError(4, "Size Limit Exceeded") });
  await expectCode(authenticateWithAD("joao.silva", "x", { config, clientFactory: b.factory }), "invalid_credentials", "ambiguous_user");
});

test("senha expirada (AD data 532/773) => password_expired", async () => {
  for (const sub of ["532", "773"]) {
    const { factory } = makeAD({
      entries: [JOAO],
      userBindError: ldapError(49, `80090308: LdapErr: DSID-0C09044E, comment: AcceptSecurityContext error, data ${sub}, v4563`),
    });
    await expectCode(authenticateWithAD("joao.silva", "Senha@2026", { config, clientFactory: factory }), "password_expired");
  }
});

test("conta bloqueada (data 775) NÃO é revelada", async () => {
  const { factory } = makeAD({
    entries: [JOAO],
    userBindError: ldapError(49, "80090308: LdapErr: DSID-0C09044E, data 775, v4563"),
  });
  await expectCode(authenticateWithAD("joao.silva", "Senha@2026", { config, clientFactory: factory }), "invalid_credentials");
});
