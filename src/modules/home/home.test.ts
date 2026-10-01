import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { buildMeuDia, limitBanners, sortAnnouncements, upcomingBirthdays } from "./meu-dia";
import { EMPTY_HOME, getHomeData } from "./service";
import { birthdayLabel, daysUntilBirthday, greeting, isSameDay, relativeDay } from "./time";
import type { HomeAnnouncement, HomeBanner, HomeData } from "./types";

// 29/09/2026 10:00 em America/Bahia (UTC−3).
const NOW = new Date("2026-09-29T13:00:00Z");

function announcement(over: Partial<HomeAnnouncement>): HomeAnnouncement {
  return { id: "a", title: "T", summary: "", category: "C", publishedAt: NOW, pinned: false, pendingAcknowledgement: false, ...over };
}

describe("tempo no fuso corporativo (RN-CORE-003)", () => {
  it("saudação pela hora de America/Bahia, não UTC", () => {
    expect(greeting(new Date("2026-09-29T14:59:00Z"))).toBe("Bom dia"); // 11:59 local
    expect(greeting(new Date("2026-09-29T15:00:00Z"))).toBe("Boa tarde");
    expect(greeting(new Date("2026-09-29T21:00:00Z"))).toBe("Boa noite");
  });

  it("'hoje' vira à meia-noite local", () => {
    expect(isSameDay(new Date("2026-09-30T02:59:00Z"), NOW)).toBe(true); // 23:59 local do dia 29
    expect(isSameDay(new Date("2026-09-30T03:00:00Z"), NOW)).toBe(false);
  });

  it("rótulos relativos", () => {
    expect(relativeDay(NOW, NOW)).toBe("Hoje");
    expect(relativeDay(new Date("2026-09-28T13:00:00Z"), NOW)).toBe("Ontem");
    expect(relativeDay(new Date("2026-09-25T13:00:00Z"), NOW)).toBe("25/09");
  });

  it("aniversário: hoje, amanhã, data e virada de ano", () => {
    expect(birthdayLabel(29, 9, NOW)).toBe("Hoje");
    expect(birthdayLabel(30, 9, NOW)).toBe("Amanhã");
    expect(birthdayLabel(2, 10, NOW)).toBe("02/10");
    expect(daysUntilBirthday(28, 9, NOW)).toBe(364);
    expect(daysUntilBirthday(1, 1, new Date("2026-12-31T13:00:00Z"))).toBe(1);
  });

  it("29/02 em ano não bissexto cai em 28/02", () => {
    expect(daysUntilBirthday(29, 2, new Date("2027-02-28T13:00:00Z"))).toBe(0);
  });
});

describe("Meu Dia (§11, RN-HOME-002/003)", () => {
  const base: HomeData = {
    ...EMPTY_HOME,
    announcements: [announcement({ id: "p", title: "Política", pendingAcknowledgement: true })],
    eventsToday: [
      { id: "e2", title: "Depois", location: "", startsAt: new Date("2026-09-29T19:00:00Z") },
      { id: "e1", title: "Antes", location: "", startsAt: new Date("2026-09-29T17:30:00Z") },
      { id: "passado", title: "Já foi", location: "", startsAt: new Date("2026-09-29T11:00:00Z") },
    ],
    documents: [{ id: "d", title: "POP", area: "", version: "1", updatedAt: NOW, isNew: true }],
  };

  it("ordena ciência pendente, eventos de hoje por horário e corta em 3", () => {
    const items = buildMeuDia(base, NOW);
    expect(items.map((i) => (i.kind === "documents" ? "docs" : i.id))).toEqual(["p", "e1", "e2"]);
  });

  it("ignora evento que já passou e agrupa documentos novos", () => {
    const items = buildMeuDia({ ...base, announcements: [], eventsToday: base.eventsToday.slice(2) }, NOW);
    expect(items).toEqual([{ kind: "documents", count: 1, titles: ["POP"] }]);
  });

  it("vazio quando não há nada (RN-HOME-006)", () => {
    expect(buildMeuDia(EMPTY_HOME, NOW)).toEqual([]);
  });
});

describe("ordenação e limites", () => {
  it("comunicados: pendente, fixado, depois recentes", () => {
    const list = sortAnnouncements([
      announcement({ id: "velho", publishedAt: new Date("2026-09-01T00:00:00Z") }),
      announcement({ id: "fixado", pinned: true, publishedAt: new Date("2026-09-02T00:00:00Z") }),
      announcement({ id: "novo" }),
      announcement({ id: "pendente", pendingAcknowledgement: true, publishedAt: new Date("2026-08-01T00:00:00Z") }),
    ]);
    expect(list.map((a) => a.id)).toEqual(["pendente", "fixado", "novo", "velho"]);
  });

  it("no máximo 3 banners (RN-HOME-005)", () => {
    const b: HomeBanner = { id: "b", eyebrow: "", title: "", body: "", note: null };
    expect(limitBanners([b, b, b, b, b])).toHaveLength(3);
  });

  it("aniversariantes dos próximos 7 dias, mais próximo primeiro", () => {
    const person = (id: string, day: number, month: number) => ({ id, name: id, department: "", unit: "", day, month });
    const list = upcomingBirthdays([person("fora", 10, 10), person("sab", 3, 10), person("hoje", 29, 9)], NOW);
    expect(list.map((p) => p.id)).toEqual(["hoje", "sab"]);
  });
});

describe("service da Home", () => {
  it("fora do modo demo, usuário sem cadastro ativo recebe tudo vazio", async () => {
    const prisma = { user: { findUnique: async () => null } } as unknown as PrismaClient;
    expect(await getHomeData({ demo: false, now: NOW, prisma, userId: "u1" })).toEqual(EMPTY_HOME);
  });

  it("no modo demo usa fixtures já ordenadas e limitadas", async () => {
    const data = await getHomeData({ demo: true, now: NOW, prisma: {} as PrismaClient, userId: "u1" });
    expect(data.announcements[0]?.pendingAcknowledgement).toBe(true);
    expect(data.banners.length).toBeLessThanOrEqual(3);
    expect(data.birthdays[0]?.day).toBe(29);
  });
});
