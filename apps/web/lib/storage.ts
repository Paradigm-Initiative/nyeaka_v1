import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type AllowedImageType = keyof typeof ALLOWED_IMAGE_TYPES;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const PRESIGN_TTL_SECONDS = 120;

let client: S3Client | undefined;
function s3() {
  client ??= new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    // R2 rejects the CRC32 checksum headers newer SDK versions add by default.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

const publicBase = () => (process.env.S3_PUBLIC_URL ?? "").replace(/\/+$/, "");

/** Every upload for a user lives under this prefix; saved URLs are checked against it. */
export const listingPhotoPrefix = (userId: string) =>
  `${publicBase()}/listings/${userId}/`;

export async function presignListingPhoto(
  userId: string,
  contentType: AllowedImageType,
  size: number,
) {
  const key = `listings/${userId}/${randomUUID()}.${ALLOWED_IMAGE_TYPES[contentType]}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: size, // signed, so the upload can't exceed what we validated
    }),
    { expiresIn: PRESIGN_TTL_SECONDS },
  );
  return { uploadUrl, publicUrl: `${publicBase()}/${key}` };
}
