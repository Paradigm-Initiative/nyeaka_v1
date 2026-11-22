import { cronRoute } from "@/lib/cron-auth";
import { sendStaleQueueAlert } from "@/lib/review-alerts";

// Scheduled job: emails once about ID cases that have waited past the 36-hour target.
// Same protection and triggers as /api/cron/purge. Safe to call repeatedly: each case is
// alerted once (IdVerification.staleAlertedAt).
export const dynamic = "force-dynamic";

const handle = cronRoute("review-alerts", () => sendStaleQueueAlert());
export const GET = handle;
export const POST = handle;
