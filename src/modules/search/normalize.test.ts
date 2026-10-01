import { describe, expect, it } from "vitest";
import { foldText, likeEscape, normalizeQuery } from "./normalize";

describe("normalização da busca (RN-SRC-005/006, §99)", () => {
  it("ignora acento e caixa", () => {
    expect(foldText("  Operações  FISCAIS ")).toBe("operacoes fiscais");
  });

  it("transforma as perguntas do §99 no assunto", () => {
    expect(normalizeQuery("Quem é responsável pelo Fiscal?")).toBe("fiscal");
    expect(normalizeQuery("Quem cuida da infraestrutura?")).toBe("infraestrutura");
    expect(normalizeQuery("Quem é responsável pelo orçamento?")).toBe("orcamento");
    expect(normalizeQuery("Quem posso procurar sobre logística?")).toBe("logistica");
    expect(normalizeQuery("com quem falo sobre compras")).toBe("compras");
  });

  it("mantém consultas simples", () => {
    expect(normalizeQuery("Gerente de TI")).toBe("gerente de ti");
    expect(normalizeQuery("a")).toBe("a");
  });

  it("escapa curingas do LIKE", () => {
    expect(likeEscape("50%_off\\")).toBe(String.raw`50\%\_off\\`);
  });
});
