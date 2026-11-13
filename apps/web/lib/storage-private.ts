import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, type AllowedImageType } from "./storage";

/**
 * The PRIVATE bucket for ID documents and selfies (env `S3_PRIVATE_BUCKET`).
 * Same endpoint and credentials as the public photo bucket, so the access key must be
 * allowed on both buckets. Nothing here is ever public: images are read only through
 * short-lived signed URLs, and are deleted 30 days after the review decision.
 */
export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES };
export type { AllowedImageType };

const UPLOAD_TTL_SECONDS = 300;
export const VIEW_TTL_SECONDS = 60;

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

function bucket(): string {
  const b = process.env.S3_PRIVATE_BUCKET;
  if (!b) throw new Error("S3_PRIVATE_BUCKET is not set");
  return b;
}

/** Every key a user uploads lives under this prefix; submitted keys are checked against it. */
export const idKeyPrefix = (userId: string) => `id/${userId}/`;

export const isOwnIdKey = (userId: string, key: unknown): key is string =>
  typeof key === "string" && key.startsWith(idKeyPrefix(userId)) && !key.includes("..") && key.length < 200;

/** A signed upload URL for one ID image. The key is random, so it can't be guessed or overwritten. */
export async function presignIdUpload(userId: string, contentType: AllowedImageType, size: number) {
  const key = `${idKeyPrefix(userId)}${randomUUID()}.${ALLOWED_IMAGE_TYPES[contentType]}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      ContentLength: size, // signed, so the upload can't exceed what we validated
    }),
    { expiresIn: UPLOAD_TTL_SECONDS },
  );
  return { uploadUrl, key };
}

/** A 60-second read URL for the reviewer. Never store or log it. */
export function presignIdView(key: string): Promise<string> {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: VIEW_TTL_SECONDS,
  });
}

/** Delete objects (used by the purge job). Missing keys are not an error in S3/R2. */
export async function deleteIdObjects(keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    const res = await s3().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    if (res.Errors?.length) throw new Error(`Could not delete ${res.Errors.length} ID object(s)`);
  }
}

/**
 * True only if every key is an uploaded image in the private bucket within the size and
 * type limits. Checked at submit time, so a submission can't point at files that were never
 * uploaded (or were swapped for something else). Any lookup failure counts as "not there".
 */
export async function idObjectsExist(keys: string[]): Promise<boolean> {
  const allowed: string[] = Object.keys(ALLOWED_IMAGE_TYPES);
  try {
    const heads = await Promise.all(keys.map((Key) => s3().send(new HeadObjectCommand({ Bucket: bucket(), Key }))));
    return heads.every(
      (h) => (h.ContentLength ?? 0) > 0 && (h.ContentLength ?? 0) <= MAX_IMAGE_BYTES && allowed.includes(h.ContentType ?? ""),
    );
  } catch {
    return false;
  }
}
