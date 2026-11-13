/**
 * Browser only. Re-draws a photo onto a canvas and re-encodes it as JPEG, which drops
 * EXIF (GPS position, device, timestamps) before the image leaves the person's phone.
 * Orientation is applied to the pixels first, so the picture still looks right.
 * Large photos are scaled down so they stay under the upload limit.
 */
const MAX_SIDE = 2400;

export async function stripImageMetadata(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("uploadFailed");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("uploadFailed");
    return new File([blob], "id.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
