import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** Scheduled-job routes: `Authorization: Bearer $CRON_SECRET` (Vercel Cron today, a Coolify scheduled task later). */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never open when the secret is missing
  const sent = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return sent.length === want.length && timingSafeEqual(sent, want);
}

/** Wrap a job as a protected route handler. A failure is logged and answered with a bare 500. */
export function cronRoute(name: string, job: () => Promise<unknown>) {
  return async function handle(request: Request) {
    if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
    if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const result = await job();
      console.log(name, result);
      return NextResponse.json(result);
    } catch (e) {
      console.error(`${name} failed`, e);
      return NextResponse.json({ error: `${name} failed` }, { status: 500 });
    }
  };
}
