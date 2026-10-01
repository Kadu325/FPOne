import net from "node:net";
import { Client } from "ldapts";

const env = process.env;
const host = env.LDAP_HOST;
const port = Number(env.LDAP_PORT || 389);
const baseDN = env.LDAP_BASE_DN;
const bindDN = env.LDAP_BIND_DN;
const password = env.LDAP_BIND_PASSWORD || "";
const filterBase = env.LDAP_USER_FILTER;
const loginAttribute = env.LDAP_LOGIN_ATTRIBUTE || "sAMAccountName";
const username = process.argv[2] || env.AD_TEST_USERNAME;
const escapeFilter = (value) => value.replace(/\\/g, "\\5c").replace(/\*/g, "\\2a").replace(/\(/g, "\\28").replace(/\)/g, "\\29").replace(/\0/g, "\\00");
const ldapError = (error) => error?.code || error?.name || (error instanceof Error ? error.message : String(error));

function tcpCheck() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error("ETIMEDOUT")); }, Number(env.LDAP_CONNECT_TIMEOUT_MS || 5000));
    socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve(); });
    socket.once("error", (error) => { clearTimeout(timer); socket.destroy(); reject(error); });
  });
}

async function main() {
  const required = ["LDAP_HOST", "LDAP_BASE_DN", "LDAP_BIND_DN", "LDAP_BIND_PASSWORD", "LDAP_USER_FILTER"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`variáveis ausentes: ${missing.join(", ")}`);
  console.log(`Servidor: ${host}:${port}`);
  console.log(`Bind DN: ${bindDN}`);
  console.log(`Senha: ${password.length} caracteres; aspas literais=${/^['"].*['"]$/.test(password)}`);
  await tcpCheck(); console.log("TCP: OK");
  const client = new Client({ url: `ldap://${host}:${port}`, timeout: Number(env.LDAP_TIMEOUT_MS || 8000), connectTimeout: Number(env.LDAP_CONNECT_TIMEOUT_MS || 5000) });
  try {
    await client.bind(bindDN, password); console.log("Service bind: OK");
    if (!username) return;
    const normalized = username.trim().split("\\").at(-1).split("@")[0];
    const filter = `(&${filterBase}(${loginAttribute}=${escapeFilter(normalized)}))`;
    const result = await client.search(baseDN, { scope: "sub", filter, attributes: ["sAMAccountName", "displayName", "userAccountControl"], sizeLimit: 2 });
    console.log(`User search: ${result.searchEntries.length === 1 ? "OK" : "FAIL"} (${result.searchEntries.length} resultado(s))`);
  } finally { await client.unbind().catch(() => {}); }
}
main().catch((error) => { console.error(`AD_DIAGNOSE_FAIL: ${ldapError(error)}`); process.exitCode = 1; });
