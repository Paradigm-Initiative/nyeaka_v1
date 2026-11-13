import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "@/lib/get-session";
import { listOpenReports } from "@/lib/moderation";
import { adminDate } from "@/lib/admin-format";
import { reasonLabel } from "@/lib/report-options";
import ReportActions from "@/components/admin/report-actions";

export const metadata: Metadata = { title: "Reports - Nyeaka admin" };
export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = (await getServerSession())!;
  const { page } = await searchParams;
  const { rows, total, pages, ...rest } = await listOpenReports(session.user.id, Number(page) || 1);
  const current = Math.max(1, Number(page) || 1);
  void rest;

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="text-heading-2">Reports</h1>
      <p className="text-muted-foreground text-body-sm">
        {total} open, oldest first. Three different people reporting someone restricts them automatically; suspending is
        a manual decision.
      </p>
      {rows.length === 0 ? (
        <p className="p-4 border rounded-lg text-muted-foreground">Nothing to review.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const post = r.targetListing ?? r.targetRequest;
            return (
              <li key={r.id} className="flex flex-col gap-2 p-4 border rounded-lg">
                <div className="flex flex-wrap justify-between gap-2 text-body-sm">
                  <span>
                    <strong>{r.reporter.name}</strong> reported{" "}
                    <strong>{r.reportedUser.name}</strong>
                    {r.reportedUser.restrictedAt && <span className="ml-2 badge badge-orange">Restricted</span>}
                    {r.reportedUser.suspendedAt && <span className="ml-2 badge badge-orange">Suspended</span>}
                    {r.reportedUser.deletedAt && <span className="ml-2 badge">Deleted account</span>}
                  </span>
                  <span className="text-muted-foreground">{adminDate(r.createdAt)}</span>
                </div>
                <p className="text-body-sm">
                  <strong>{reasonLabel(r.reason)}</strong> · about {r.targetType.toLowerCase()}
                  {post ? `: “${post.title}” (${post.status})` : ""}
                  {" · "}
                  {r.reporters} different {r.reporters === 1 ? "person has" : "people have"} open reports on them
                </p>
                {r.targetMessage && (
                  <blockquote className="pl-3 border-l-2 text-body-sm break-words whitespace-pre-wrap">{r.targetMessage.body}</blockquote>
                )}
                {r.details && <p className="text-muted-foreground text-body-sm">“{r.details}”</p>}
                <ReportActions
                  reportId={r.id}
                  userId={r.reportedUser.id}
                  userName={r.reportedUser.name}
                  hasPost={!!post}
                  restricted={!!r.reportedUser.restrictedAt}
                  suspended={!!r.reportedUser.suspendedAt || !!r.reportedUser.deletedAt}
                  isAdmin={r.reportedUser.role === "ADMIN"}
                />
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex gap-4 text-body-sm">
          {current > 1 && <Link href={`/admin/reports?page=${current - 1}`} className="text-link hover:underline">Newer</Link>}
          <span>Page {current} of {pages}</span>
          {current < pages && <Link href={`/admin/reports?page=${current + 1}`} className="text-link hover:underline">Older</Link>}
        </div>
      )}
    </div>
  );
}
