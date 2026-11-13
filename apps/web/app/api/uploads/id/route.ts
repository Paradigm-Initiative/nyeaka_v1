import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/neon-db";
import { getServerSession } from "@/lib/get-session";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  presignIdUpload,
  type AllowedImageType,
} from "@/lib/storage-private";

const bodySchema = z.object({
  contentType: z.enum(Object.keys(ALLOWED_IMAGE_TYPES) as [AllowedImageType, ...AllowedImageType[]], {
    error: "uploadType",
  }),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES, "uploadTooBig"),
});

// Error values are translation keys in the `errors` namespace.
export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "uploadSignIn" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "uploadInvalid" }, { status: 400 });

  // Only people who can still submit may upload, so the bucket isn't an open dropbox.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { idVerificationStatus: true },
  });
  if (!user || user.idVerificationStatus === "PENDING" || user.idVerificationStatus === "VERIFIED")
    return NextResponse.json({ error: "verifyNotAllowed" }, { status: 403 });

  try {
    const { contentType, size } = parsed.data;
    return NextResponse.json(await presignIdUpload(session.user.id, contentType, size));
  } catch (e) {
    console.error("id presign failed", e);
    return NextResponse.json({ error: "uploadFailed" }, { status: 500 });
  }
}
