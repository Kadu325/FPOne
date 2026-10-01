import { test } from "node:test";
import assert from "node:assert/strict";

import { buildUserSearchFilter, escapeFilterValue } from "../src/lib/ldap/escape";
import { isWellFormedFilter, parseLdapConfig } from "../src/lib/ldap/config";
import { isAcceptablePassword, normalizeUsername } from "../src/lib/auth/username";
import { SlidingWindowLimiter } from "../src/lib/auth/rate-limit";
import { messageForCode } from "../src/lib/auth/errors";

const FILTER =
  "(&(objectClass=user)(objectCategory=person)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))";

test("escapa caracteres especiais do filtro (RFC 4515)", () => {
  assert.equal(escapeFilterValue("joao.silva"), "joao.silva");
  assert.equal(escapeFilterValue("*"), "\\2a");
  assert.equal(escapeFilterValue("a)(cn=*"), "a\\29\\28cn=\\2a");
  assert.equal(escapeFilterValue("x\\y\0"), "x\\5cy\\00");
});

test("filtro final combina usuários ativos + sAMAccountName escapado", () => {
  assert.equal(
    buildUserSearchFilter(FILTER, "sAMAccountName", "joao.silva"),
    `(&${FILTER}(sAMAccountName=joao.silva))`,
  );
  // tentativa de injeção vira literal
  const injected = buildUserSearchFilter(FILTER, "sAMAccountName", "*)(|(cn=*");
  assert.ok(!injected.includes("(|(cn=*"));
  assert.ok(isWellFormedFilter(injected));
});

test("normaliza login: usuário, DOMÍNIO\\usuário e usuário@domínio", () => {
  assert.equal(normalizeUsername("  joao.silva "), "joao.silva");
  assert.equal(normalizeUsername("FP\\joao.silva"), "joao.silva");
  assert.equal(normalizeUsername("joao.silva@fazendaprogresso.com.local"), "joao.silva");
  assert.equal(normalizeUsername("joão"), "joão");
  assert.equal(normalizeUsername(""), null);
  assert.equal(normalizeUsername("   "), null);
  assert.equal(normalizeUsername("a*b"), null);
  assert.equal(normalizeUsername("a(b)"), "a(b)"); // permitido no AD; escapado no filtro
  assert.equal(normalizeUsername("x".repeat(65)), null);
  assert.equal(normalizeUsername(undefined), null);
});

test("senha vazia é rejeitada (evita bind anônimo aceito pelo AD)", () => {
  assert.equal(isAcceptablePassword(""), false);
  assert.equal(isAcceptablePassword(undefined), false);
  assert.equal(isAcceptablePassword(" "), true);
  assert.equal(isAcceptablePassword("x".repeat(257)), false);
});

test("lê a configuração do .env com os parâmetros do AD", () => {
  const cfg = parseLdapConfig({
    LDAP_HOST: "192.168.77.250",
    LDAP_PORT: "389",
    LDAP_BASE_DN: "dc=fazendaprogresso,dc=com,dc=local",
    LDAP_BIND_DN: "FP\\glpi",
    LDAP_BIND_PASSWORD: "segredo#1",
    LDAP_LOGIN_ATTRIBUTE: "sAMAccountName",
    LDAP_USER_FILTER: FILTER,
  });
  assert.equal(cfg.url, "ldap://192.168.77.250:389");
  assert.equal(cfg.security, "none");
  assert.equal(cfg.bindDN, "FP\\glpi");
  assert.equal(cfg.bindPassword, "segredo#1");
  assert.equal(cfg.userFilter, FILTER);
  assert.equal(cfg.timeoutMs, 5000);
});

test("configuração incompleta falha sem vazar valores", () => {
  assert.throws(
    () => parseLdapConfig({ LDAP_HOST: "h", LDAP_BIND_PASSWORD: "NAO-VAZAR" }),
    (err: Error) => err.name === "LdapConfigError" && !err.message.includes("NAO-VAZAR"),
  );
  assert.throws(() =>
    parseLdapConfig({
      LDAP_HOST: "h",
      LDAP_BASE_DN: "dc=x",
      LDAP_BIND_DN: "x",
      LDAP_BIND_PASSWORD: "y",
      LDAP_USER_FILTER: "(&(a=b)",
    }),
  );
});

test("ldaps usa porta 636 por padrão", () => {
  const cfg = parseLdapConfig({
    LDAP_HOST: "dc01.fazendaprogresso.com.local",
    LDAP_SECURITY: "ldaps",
    LDAP_BASE_DN: "dc=x",
    LDAP_BIND_DN: "x",
    LDAP_BIND_PASSWORD: "y",
    LDAP_USER_FILTER: "(objectClass=user)",
  });
  assert.equal(cfg.url, "ldaps://dc01.fazendaprogresso.com.local:636");
});

test("rate limit bloqueia após N falhas e libera após a janela", () => {
  let now = 0;
  const lim = new SlidingWindowLimiter(3, 1000, 100, () => now);
  for (let i = 0; i < 3; i++) {
    assert.equal(lim.check("u").allowed, true);
    lim.hit("u");
  }
  const blocked = lim.check("u");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSec, 1);
  now = 1001;
  assert.equal(lim.check("u").allowed, true);
  lim.hit("u");
  lim.reset("u");
  assert.equal(lim.check("u").allowed, true);
});

test("mensagens para o usuário são genéricas", () => {
  assert.equal(messageForCode("invalid_credentials"), "Usuário ou senha inválidos.");
  assert.equal(messageForCode("qualquer_coisa"), "Usuário ou senha inválidos.");
  assert.match(messageForCode("service_unavailable"), /indisponível/);
  assert.ok(!/192\.168|ldap|ECONN/i.test(messageForCode("service_unavailable")));
});
