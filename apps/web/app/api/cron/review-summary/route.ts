import { cronRoute } from "@/lib/cron-auth";
import { sendWeeklySummary } from "@/lib/review-alerts";

// Scheduled job: the weekly plain-English summary of the ID review queue. Same protection
// and triggers as /api/cron/purge. Calling it twice sends it twice, so schedule it weekly.
export const dynamic = "force-dynamic";

const handle = cronRoute("review-summary", () => sendWeeklySummary());
export const GET = handle;
export const POST = handle;
