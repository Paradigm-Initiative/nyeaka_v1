import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "@/lib/get-session";
import { listAdminActions } from "@/lib/admin-queries";
import { adminDate } from "@/lib/admin-format";

export const metadata: Metadata = { title: "Activity log - Nyeaka admin" };
export const dynamic = "force-dynamic";

export default async function AdminLogPage({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  const session = (await getServerSession())!;
  const sp = await searchParams;
  const { rows, page, pages, total, actions } = await listAdminActions(session.user.id, {
    page: Number(sp.page) || 1,
    action: sp.action,
  });
  const q = (p: number) => `/admin/log?page=${p}${sp.action ? `&action=${encodeURIComponent(sp.action)}` : ""}`;

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <h1 className="text-heading-2">Activity log</h1>
      <div className="flex flex-wrap gap-2 text-body-sm">
        <Link href="/admin/log" className="px-3 py-1 border rounded-full">All</Link>
        {actions.map((a) => (
          <Link key={a} href={`/admin/log?action=${encodeURIComponent(a)}`} className="px-3 py-1 border rounded-full">{a}</Link>
        ))}
      </div>
      <p className="text-muted-foreground text-body-sm">{total} entries</p>
      <ul className="divide-y border rounded-lg">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-col gap-0.5 px-4 py-2 text-body-sm">
            <span className="flex flex-wrap justify-between gap-2">
              <span>
                <strong>{a.actor.name}</strong> · {a.action} · {a.targetType}
                {a.targetId && (a.targetType === "IdVerification" ? (
                  <Link href={`/admin/verifications/${a.targetId}`} className="ml-1 text-link hover:underline">{a.targetId}</Link>
                ) : ` ${a.targetId}`)}
              </span>
              <span className="text-muted-foreground">{adminDate(a.createdAt)}</span>
            </span>
            {a.reason && <span className="text-muted-foreground">Reason: {a.reason}</span>}
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-3 text-muted-foreground">No entries.</li>}
      </ul>
      {pages > 1 && (
        <div className="flex gap-4 text-body-sm">
          {page > 1 && <Link href={q(page - 1)} className="text-link hover:underline">Newer</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link href={q(page + 1)} className="text-link hover:underline">Older</Link>}
        </div>
      )}
    </div>
  );
}
