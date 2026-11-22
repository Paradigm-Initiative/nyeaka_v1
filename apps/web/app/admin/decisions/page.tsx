import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { isAdmin } from "@/lib/admin";
import { listDecisions, reviewerStats, waitText } from "@/lib/verification-audit";
import { REJECTION_LABEL, isRejectionCode } from "@/lib/rejection-reasons";
import { adminDate, DOC_LABEL } from "@/lib/admin-format";
import { countryName } from "@/lib/countries";

export const metadata: Metadata = { title: "Decisions - Nyeaka admin" };
export const dynamic = "force-dynamic";

type SP = { reviewer?: string; outcome?: string; from?: string; to?: string; page?: string };

const day = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? new Date(`${v}T00:00:00Z`) : undefined);

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = (await getServerSession())!;
  if (!(await isAdmin(session.user.id))) notFound(); // admin only
  const sp = await searchParams;
  const from = day(sp.from);
  const toDay = day(sp.to);
  const to = toDay ? new Date(toDay.getTime() + 86_400_000) : undefined; // inclusive of the chosen day
  const outcome: "VERIFIED" | "FAILED" | undefined = sp.outcome === "VERIFIED" ? "VERIFIED" : sp.outcome === "FAILED" ? "FAILED" : undefined;
  const filter = { reviewerId: sp.reviewer || undefined, outcome, from, to, page: Number(sp.page) || 1 };
  const [{ rows, total, page, pages, reviewers }, stats] = await Promise.all([
    listDecisions(session.user.id, filter),
    reviewerStats(session.user.id, { outcome, from, to }),
  ]);
  const q = (p: number) => {
    const u = new URLSearchParams();
    for (const k of ["reviewer", "outcome", "from", "to"] as const) if (sp[k]) u.set(k, sp[k]!);
    u.set("page", String(p));
    return `/admin/decisions?${u}`;
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <h1 className="text-heading-2">ID decisions</h1>

      <form className="flex flex-wrap items-end gap-3 text-body-sm">
        <label className="flex flex-col gap-1">Reviewer
          <select name="reviewer" defaultValue={sp.reviewer ?? ""} className="px-2 py-1 border rounded-md">
            <option value="">Everyone</option>
            {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">Outcome
          <select name="outcome" defaultValue={outcome ?? ""} className="px-2 py-1 border rounded-md">
            <option value="">Any</option>
            <option value="VERIFIED">Approved</option>
            <option value="FAILED">Rejected</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">From
          <input type="date" name="from" defaultValue={sp.from ?? ""} className="px-2 py-1 border rounded-md" />
        </label>
        <label className="flex flex-col gap-1">To
          <input type="date" name="to" defaultValue={sp.to ?? ""} className="px-2 py-1 border rounded-md" />
        </label>
        <button type="submit" className="px-3 py-1.5 border rounded-md font-semibold">Filter</button>
        <Link href="/admin/decisions" className="py-1.5 text-link hover:underline">Clear</Link>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-4">Per reviewer</h2>
        {stats.length === 0 ? (
          <p className="text-muted-foreground text-body-sm">No decisions in this range.</p>
        ) : (
          <table className="border rounded-lg w-full text-body-sm">
            <thead className="text-muted-foreground text-left">
              <tr><th className="p-2">Reviewer</th><th className="p-2">Decisions</th><th className="p-2">Approve rate</th><th className="p-2">Median wait until decided</th></tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-2 font-semibold">{s.name}</td>
                  <td className="p-2">{s.count} ({s.approved} approved, {s.rejected} rejected)</td>
                  <td className="p-2">{Math.round(s.approveRate * 100)}%</td>
                  <td className="p-2">{waitText(s.medianWaitMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-4">Decisions ({total})</h2>
        {rows.length === 0 ? (
          <p className="p-4 border rounded-lg text-muted-foreground">Nothing matches.</p>
        ) : (
          <ul className="divide-y border rounded-lg">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/verifications/${r.id}`} className="flex flex-wrap justify-between gap-2 px-4 py-3 hover:bg-surface-feature">
                  <span className="flex flex-col">
                    <span className="font-semibold">
                      {r.user.name} · {r.status === "VERIFIED" ? "Approved" : "Rejected"}
                      {r.rejectionCode && isRejectionCode(r.rejectionCode) ? `: ${REJECTION_LABEL[r.rejectionCode]}` : ""}
                      {r.overturnedAt && <span className="ml-2 bg-surface-feature px-2 py-0.5 border rounded text-xs">Re-decided after overturn</span>}
                    </span>
                    <span className="text-muted-foreground text-caption">
                      {countryName(r.countryCode, "en")} · {DOC_LABEL[r.documentType] ?? r.documentType} · by {r.reviewedBy?.name ?? "unknown"}
                      {r.firstDecisionBy ? ` (second reviewer after ${r.firstDecisionBy.name})` : ""} · images {r.imagesPurgedAt ? "deleted" : r.imagesPurgeAt ? `until ${adminDate(r.imagesPurgeAt)}` : "kept"}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-caption">{r.decidedAt ? adminDate(r.decidedAt) : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex gap-4 text-body-sm">
            {page > 1 && <Link href={q(page - 1)} className="text-link hover:underline">Newer</Link>}
            <span className="text-muted-foreground">Page {page} of {pages}</span>
            {page < pages && <Link href={q(page + 1)} className="text-link hover:underline">Older</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
