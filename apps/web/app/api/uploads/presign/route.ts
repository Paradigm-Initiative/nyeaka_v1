import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/get-session";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  presignListingPhoto,
  type AllowedImageType,
} from "@/lib/storage";

const bodySchema = z.object({
  contentType: z.enum(Object.keys(ALLOWED_IMAGE_TYPES) as [AllowedImageType, ...AllowedImageType[]], {
    error: "uploadType",
  }),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES, "uploadTooBig"),
});

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: "uploadSignIn" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "uploadInvalid" },
      { status: 400 },
    );
  }

  try {
    const { contentType, size } = parsed.data;
    return NextResponse.json(await presignListingPhoto(session.user.id, contentType, size));
  } catch (e) {
    console.error("presign failed", e);
    return NextResponse.json({ error: "uploadFailed" }, { status: 500 });
  }
}
