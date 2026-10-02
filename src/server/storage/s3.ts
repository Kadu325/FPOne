import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BusinessError } from "@/lib/errors";
import { serverEnv } from "@/lib/env";

/**
 * Cliente MinIO (API S3-compatível). Bucket privado; upload e remoção pela rede interna;
 * download só por URL pré-assinada curta (CLAUDE.md, RN-DOC-007), assinada com a origem
 * pública repassada pelo proxy reverso.
 *
 * MinIO usa região padrão "us-east-1" e forcePathStyle=true.
 */

export const DOWNLOAD_URL_TTL_SECONDS = 60;

interface StorageConfig {
  bucket: string;
  internal: S3Client;
  publicSigner: S3Client;
}

let cached: StorageConfig | undefined;

function config(): StorageConfig {
  if (cached) return cached;
  const env = serverEnv();
  if (!env.S3_BUCKET || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_PUBLIC_URL) {
    throw new BusinessError("ERR_STORAGE_UNAVAILABLE");
  }
  const credentials = { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY };
  const common = { region: "us-east-1", forcePathStyle: true, credentials };
  cached = {
    bucket: env.S3_BUCKET,
    internal: new S3Client({ ...common, endpoint: env.MINIO_ENDPOINT ?? env.GARAGE_ENDPOINT ?? "http://minio:9000" }),
    publicSigner: new S3Client({ ...common, endpoint: new URL(env.S3_PUBLIC_URL).origin }),
  };
  return cached;
}

export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const { internal, bucket } = config();
  await internal.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function deleteObject(key: string): Promise<void> {
  const { internal, bucket } = config();
  await internal.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** URL de download válida por 60 s, com o nome original e sempre como anexo. */
export async function presignDownload(key: string, fileName: string, mime: string): Promise<string> {
  const { publicSigner, bucket } = config();
  const encoded = encodeURIComponent(fileName);
  return getSignedUrl(
    publicSigner,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename*=UTF-8''${encoded}`,
      ResponseContentType: mime,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}
