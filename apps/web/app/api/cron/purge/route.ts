import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runPurge } from "@/lib/purge";

// Scheduled job: deletes ID images 30 days after the review decision and closes
// submissions nobody reviewed. Triggered by Vercel Cron today (vercel.json) and by a
// Coolify scheduled task later; both send `Authorization: Bearer $CRON_SECRET`.
// Safe to call repeatedly (see lib/purge.ts).
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never open when the secret is missing
  const sent = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return sent.length === want.length && timingSafeEqual(sent, want);
}

async function handle(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await runPurge();
    console.log("purge", result);
    return NextResponse.json(result);
  } catch (e) {
    console.error("purge failed", e);
    return NextResponse.json({ error: "Purge failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
