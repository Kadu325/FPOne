import { z } from "zod";

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    /**
     * Endpoint interno do MinIO (ex.: http://minio:9000).
     */
    MINIO_ENDPOINT: z.string().url().optional(),
    GARAGE_ENDPOINT: z.string().url().optional(),
    /** Arquivos (§182, RN-DOC-007). Sem eles, upload e download de documentos ficam indisponíveis. */
    S3_BUCKET: optional,
    S3_ACCESS_KEY: optional,
    S3_SECRET_KEY: optional,
    /** Origem pública (a mesma do navegador) usada para assinar URLs de download. */
    S3_PUBLIC_URL: optional,
    AUTH_SECRET: z.string().min(32),
    /** Pepper do HMAC do CPF gravado na carga CSV (coluna ainda obrigatória). */
    CPF_PEPPER: z.string().min(32),
    /** Retenção da trilha em meses (RN-AUD-005). */
    AUDIT_RETENTION_MONTHS: z.coerce.number().int().min(1).max(240).default(24),
    DEMO_MODE: flag,
    FEATURE_AI_SEARCH: flag,
    AD_ENABLED: flag,
  })
  .superRefine((data, ctx) => {
    if (!data.MINIO_ENDPOINT && !data.GARAGE_ENDPOINT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exige pelo menos MINIO_ENDPOINT ou GARAGE_ENDPOINT",
        path: ["MINIO_ENDPOINT"],
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Lê e valida o ambiente. Lança erro com os nomes das variáveis inválidas, nunca com valores. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const names = result.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${names}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;
export function serverEnv(): ServerEnv {
  if (process.env.NODE_ENV === "test") {
    cached ??= parseServerEnv({
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      MINIO_ENDPOINT: "http://minio:9000",
      AUTH_SECRET: "0123456789abcdef0123456789abcdef",
      CPF_PEPPER: "0123456789abcdef0123456789abcdef",
      ...process.env,
    });
    return cached;
  }
  cached ??= parseServerEnv(process.env);
  return cached;
}
