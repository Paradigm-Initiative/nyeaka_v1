import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "@/lib/get-session";
import { getAdminOverview } from "@/lib/admin-queries";
import { adminDate, ageOf } from "@/lib/admin-format";

export const metadata: Metadata = { title: "Admin - Nyeaka" };
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const session = (await getServerSession())!; // the layout already 404s without one
  const o = await getAdminOverview(session.user.id);
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="text-heading-2">Admin</h1>
      <div className="gap-4 grid sm:grid-cols-3">
        <Link href="/admin/verifications" className="p-4 border rounded-lg hover:bg-surface-feature">
          <span className="block text-heading-2">{o.pending}</span>
          <span className="text-muted-foreground text-body-sm">
            ID reviews waiting{o.oldestPendingAt ? ` · oldest ${ageOf(o.oldestPendingAt)}` : ""}
          </span>
        </Link>
        <Link href="/admin/countries" className="p-4 border rounded-lg hover:bg-surface-feature">
          <span className="block text-heading-2">{o.enabledCountries}</span>
          <span className="text-muted-foreground text-body-sm">Countries enabled</span>
        </Link>
      </div>
      <section className="flex flex-col gap-2">
        <h2 className="text-heading-3">Recent activity</h2>
        {o.recent.length === 0 ? (
          <p className="text-muted-foreground text-body-sm">Nothing yet.</p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {o.recent.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-body-sm">
                <span>
                  <strong>{a.actor.name}</strong> {a.action}
                  {a.targetId ? ` · ${a.targetType} ${a.targetId}` : ""}
                </span>
                <span className="text-muted-foreground">{adminDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/admin/log" className="text-link text-body-sm hover:underline">
          Full activity log
        </Link>
      </section>
    </div>
  );
}
