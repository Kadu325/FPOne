import { describe, expect, it } from "vitest";
import { clientIp } from "./ip";

describe("clientIp", () => {
  it("usa o primeiro IP do X-Forwarded-For", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "200.1.2.3, 172.18.0.5" }))).toBe("200.1.2.3");
  });
  it("aceita IPv6", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "2804:14c::1" }))).toBe("2804:14c::1");
  });
  it("ignora valor que não parece IP", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "<script>" }))).toBeNull();
  });
  it("sem cabeçalho devolve null", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});
