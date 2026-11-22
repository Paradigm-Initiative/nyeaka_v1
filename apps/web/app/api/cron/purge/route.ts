import { cronRoute } from "@/lib/cron-auth";
import { runPurge } from "@/lib/purge";

// Scheduled job: deletes ID images 30 days after the review decision and closes
// submissions nobody reviewed. Triggered by Vercel Cron today (vercel.json) and by a
// Coolify scheduled task later; both send `Authorization: Bearer $CRON_SECRET`
// (lib/cron-auth.ts). Safe to call repeatedly (see lib/purge.ts).
export const dynamic = "force-dynamic";

const handle = cronRoute("purge", () => runPurge());
export const GET = handle;
export const POST = handle;
