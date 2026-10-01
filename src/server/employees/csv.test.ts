import { describe, expect, it } from "vitest";
import { errorsToCsv, parseEmployeesCsv } from "./csv";

const HEADER = "matricula;nome;unidade;departamento;cargo;cpf;email_corporativo;status";
const ROW_A = "000482;Ana Souza;Fazenda Boa Vista;Operações;Operadora;529.982.247-25;;ativo";
const ROW_B = "000483;Bruno Lima;Sede;TI;Analista;111.444.777-35;bruno@fazendaprogresso.com;ATIVO";

describe("parseEmployeesCsv (§184)", () => {
  it("lê CSV com ; e BOM, normaliza CPF, e-mail e status", () => {
    const { rows, errors } = parseEmployeesCsv(`﻿${HEADER}\r\n${ROW_A}\r\n${ROW_B}\r\n`);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 2, matricula: "000482", cpf: "52998224725", corporateEmail: null, status: "ACTIVE" });
    expect(rows[1]).toMatchObject({ corporateEmail: "bruno@fazendaprogresso.com", jobTitle: "Analista" });
  });

  it("aceita separador vírgula e coluna de e-mail ausente", () => {
    const csv = "matricula,nome,unidade,departamento,cargo,cpf,status\n000482,Ana,Sede,RH,Analista,52998224725,inativo";
    const { rows, errors } = parseEmployeesCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ status: "INACTIVE", corporateEmail: null });
  });

  it("aponta coluna obrigatória ausente", () => {
    const { rows, errors } = parseEmployeesCsv("matricula;nome\n1;Ana");
    expect(rows).toEqual([]);
    expect(errors[0]?.message).toMatch(/unidade.*departamento.*cargo.*cpf.*status/);
  });

  it("rejeita CPF inválido sem expor o valor no erro", () => {
    const { rows, errors } = parseEmployeesCsv(`${HEADER}\n000482;Ana;Sede;RH;Analista;123.456.789-00;;ativo`);
    expect(rows).toEqual([]);
    expect(errors).toEqual([{ line: 2, matricula: "000482", field: "cpf", message: "CPF inválido" }]);
    expect(errorsToCsv(errors)).not.toContain("123.456.789-00");
    expect(errorsToCsv(errors)).not.toContain("12345678900");
  });

  it("detecta matrícula e e-mail repetidos", () => {
    const dup = "000483;Outro;Sede;TI;Analista;52998224725;bruno@fazendaprogresso.com;ativo";
    const { errors } = parseEmployeesCsv(`${HEADER}\n${ROW_B}\n${dup}`);
    expect(errors.map((e) => e.field).sort()).toEqual(["email_corporativo", "matricula"]);
  });

  it("valida status, e-mail e campos obrigatórios", () => {
    const { errors } = parseEmployeesCsv(`${HEADER}\n000490;;Sede;RH;Analista;52998224725;nao-email;afastado`);
    const fields = errors.map((e) => e.field).sort();
    expect(fields).toEqual(["email_corporativo", "nome"]);
    const { errors: e2 } = parseEmployeesCsv(`${HEADER}\n000490;Ana;Sede;RH;Analista;52998224725;;afastado`);
    expect(e2).toEqual([{ line: 2, matricula: "000490", field: "status", message: "use ativo ou inativo" }]);
  });

  it("CSV malformado vira erro de arquivo", () => {
    const { errors } = parseEmployeesCsv(`${HEADER}\n000482;"Ana;Sede`);
    expect(errors[0]?.field).toBe("arquivo");
  });

  it("errorsToCsv escapa aspas", () => {
    expect(errorsToCsv([{ line: 2, matricula: 'x"y', field: "nome", message: "obrigatório" }])).toBe(
      'linha;matricula;campo;erro\r\n"2";"x""y";"nome";"obrigatório"',
    );
  });
});

describe("colunas opcionais da Fase 6", () => {
  const H6 = "matricula;nome;unidade;departamento;cargo;cpf;status;telefone_corporativo;data_nascimento";

  it("guarda só dia e mês do nascimento e aceita três formatos", () => {
    const csv = [H6, "1;Ana;Sede;RH;A;52998224725;ativo;(77) 3333-0000;15/03/1990", "2;Bia;Sede;RH;A;11144477735;ativo;;29/02", "3;Caio;Sede;RH;A;52998224725;ativo;;1985-12-01"].join("\n");
    const { rows, errors } = parseEmployeesCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ corporatePhone: "(77) 3333-0000", birth: { day: 15, month: 3 } });
    expect(rows[0]).not.toHaveProperty("birth.year");
    expect(rows[1]).toMatchObject({ corporatePhone: null, birth: { day: 29, month: 2 } });
    expect(rows[2]).toMatchObject({ birth: { day: 1, month: 12 } });
  });

  it("vazio limpa; coluna ausente não altera", () => {
    const empty = parseEmployeesCsv(`${H6}\n1;Ana;Sede;RH;A;52998224725;ativo;;`);
    expect(empty.rows[0]).toMatchObject({ corporatePhone: null, birth: null });
    const absent = parseEmployeesCsv(`${HEADER}\n${ROW_A}`);
    expect(absent.rows[0]).not.toHaveProperty("birth");
    expect(absent.rows[0]).not.toHaveProperty("corporatePhone");
  });

  it("recusa data impossível e telefone inválido", () => {
    const csv = [H6, "1;Ana;Sede;RH;A;52998224725;ativo;abc;31/02/1990", "2;Bia;Sede;RH;A;11144477735;ativo;;29/02/2023"].join("\n");
    const { rows, errors } = parseEmployeesCsv(csv);
    expect(rows).toEqual([]);
    expect(errors.map((e) => `${e.line}:${e.field}`)).toEqual(["2:data_nascimento", "2:telefone_corporativo", "3:data_nascimento"]);
  });
});
