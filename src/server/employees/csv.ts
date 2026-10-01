import { parse } from "csv-parse/sync";
import { z } from "zod";
import { isValidCpf, normalizeCpf } from "@/server/auth/cpf";

/**
 * Carga CSV de colaboradores (§184).
 */

export const REQUIRED_COLUMNS = ["matricula", "nome", "unidade", "departamento", "cargo", "cpf", "status"] as const;
export const OPTIONAL_COLUMNS = ["email_corporativo", "telefone_corporativo", "data_nascimento"] as const;
export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 20_000;

export interface EmployeeRow {
  line: number;
  matricula: string;
  name: string;
  unit: string;
  department: string;
  jobTitle: string;
  cpf: string;
  corporateEmail: string | null;
  corporatePhone?: string | null;
  birth?: { day: number; month: number } | null;
  status: "ACTIVE" | "INACTIVE";
}

/** Dia e mês de uma data de nascimento; o ano é validado e descartado. */
export function parseBirth(value: string): { day: number; month: number } | "invalid" {
  const v = value.trim();
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const [day, month, year] = br ? [Number(br[1]), Number(br[2]), br[3] ? Number(br[3]) : 2000] : iso ? [Number(iso[3]), Number(iso[2]), Number(iso[1])] : [0, 0, 0];
  if (!day || !month || month > 12) return "invalid";
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const max = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return day <= max ? { day, month } : "invalid";
}

const PHONE = /^[0-9+()\s.-]{8,20}$/;

export interface RowError {
  line: number;
  matricula: string;
  field: string;
  message: string;
}

export interface ParsedCsv {
  rows: EmployeeRow[];
  errors: RowError[];
}

const STATUS: Record<string, "ACTIVE" | "INACTIVE"> = {
  ativo: "ACTIVE",
  active: "ACTIVE",
  inativo: "INACTIVE",
  inactive: "INACTIVE",
};

const text = (max: number) => z.string().trim().min(1, "obrigatório").max(max, `máximo de ${max} caracteres`);

const rowSchema = z.object({
  matricula: z.string().trim().regex(/^[0-9A-Za-z.-]{1,20}$/, "use até 20 letras, números, ponto ou hífen"),
  nome: text(160),
  unidade: text(120),
  departamento: text(120),
  cargo: text(120),
  cpf: z.string(),
  email_corporativo: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email("e-mail inválido").nullable()),
  status: z.string().trim().toLowerCase(),
  telefone_corporativo: z.string().trim().optional(),
  data_nascimento: z.string().trim().optional(),
});

function headerOf(content: string): string {
  return content.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
}

export function parseEmployeesCsv(content: string): ParsedCsv {
  if (Buffer.byteLength(content, "utf8") > MAX_CSV_BYTES) {
    return { rows: [], errors: [{ line: 0, matricula: "", field: "arquivo", message: "arquivo maior que 5 MB" }] };
  }
  const header = headerOf(content);
  const delimiter = header.split(";").length > header.split(",").length ? ";" : ",";

  let records: Record<string, string>[];
  try {
    records = parse(content, {
      bom: true,
      delimiter,
      columns: (cols: string[]) => cols.map((c) => c.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch {
    return { rows: [], errors: [{ line: 0, matricula: "", field: "arquivo", message: "CSV malformado (aspas ou número de colunas)" }] };
  }

  const columns = records[0] ? Object.keys(records[0]) : header.split(delimiter).map((c) => c.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    return { rows: [], errors: [{ line: 1, matricula: "", field: "cabeçalho", message: `colunas ausentes: ${missing.join(", ")}` }] };
  }
  if (records.length === 0) {
    return { rows: [], errors: [{ line: 0, matricula: "", field: "arquivo", message: "nenhuma linha de dados" }] };
  }
  if (records.length > MAX_CSV_ROWS) {
    return { rows: [], errors: [{ line: 0, matricula: "", field: "arquivo", message: `máximo de ${MAX_CSV_ROWS} linhas` }] };
  }

  const rows: EmployeeRow[] = [];
  const errors: RowError[] = [];
  const seenMatricula = new Map<string, number>();
  const seenEmail = new Map<string, number>();

  records.forEach((record, index) => {
    const line = index + 2;
    const matriculaRaw = (record.matricula ?? "").trim();
    const push = (field: string, message: string) => errors.push({ line, matricula: matriculaRaw, field, message });

    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) push(String(issue.path[0] ?? "linha"), issue.message);
      return;
    }
    const r = parsed.data;
    let ok = true;

    const cpf = normalizeCpf(r.cpf);
    if (!cpf || !isValidCpf(cpf)) {
      push("cpf", "CPF inválido");
      ok = false;
    }
    const status = STATUS[r.status];
    if (!status) {
      push("status", "use ativo ou inativo");
      ok = false;
    }
    const dupLine = seenMatricula.get(r.matricula);
    if (dupLine) {
      push("matricula", `repetida (linha ${dupLine})`);
      ok = false;
    } else {
      seenMatricula.set(r.matricula, line);
    }
    if (r.email_corporativo) {
      const dupEmail = seenEmail.get(r.email_corporativo);
      if (dupEmail) {
        push("email_corporativo", `repetido (linha ${dupEmail})`);
        ok = false;
      } else {
        seenEmail.set(r.email_corporativo, line);
      }
    }
    let birth: EmployeeRow["birth"];
    if (r.data_nascimento !== undefined) {
      const parsedBirth = r.data_nascimento === "" ? null : parseBirth(r.data_nascimento);
      if (parsedBirth === "invalid") {
        push("data_nascimento", "use dd/mm/aaaa, dd/mm ou aaaa-mm-dd");
        ok = false;
      } else {
        birth = parsedBirth;
      }
    }
    let corporatePhone: EmployeeRow["corporatePhone"];
    if (r.telefone_corporativo !== undefined) {
      if (r.telefone_corporativo !== "" && !PHONE.test(r.telefone_corporativo)) {
        push("telefone_corporativo", "use de 8 a 20 dígitos, espaços, +, (, ), . ou -");
        ok = false;
      } else {
        corporatePhone = r.telefone_corporativo || null;
      }
    }
    if (!ok || !cpf || !status) return;

    rows.push({
      line,
      matricula: r.matricula,
      name: r.nome,
      unit: r.unidade,
      department: r.departamento,
      jobTitle: r.cargo,
      cpf,
      corporateEmail: r.email_corporativo,
      ...(corporatePhone !== undefined ? { corporatePhone } : {}),
      ...(birth !== undefined ? { birth } : {}),
      status,
    });
  });

  return { rows, errors };
}

export function errorsToCsv(errors: RowError[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = errors.map((e) => [e.line, e.matricula, e.field, e.message].map(esc).join(";"));
  return ["linha;matricula;campo;erro", ...lines].join("\r\n");
}
