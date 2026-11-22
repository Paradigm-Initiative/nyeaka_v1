import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "@/lib/get-session";
import { listPendingVerifications } from "@/lib/admin-queries";
import { adminDate, ageOf, DOC_LABEL } from "@/lib/admin-format";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "ID reviews - Nyeaka admin" };
export const dynamic = "force-dynamic";

export default async function VerificationsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const session = (await getServerSession())!;
  const { country } = await searchParams;
  const { countries, rows } = await listPendingVerifications(session.user.id, { country });
  const active = country?.toUpperCase();
  const chip = (on: boolean) => cn("px-3 py-1 border rounded-full text-body-sm", on && "bg-pin-green-600 text-white");

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h1 className="text-heading-2">ID reviews</h1>
      <p className="text-muted-foreground text-body-sm">Waiting for a decision, oldest first.</p>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/verifications" className={chip(!active)}>All ({countries.reduce((n, c) => n + c.count, 0)})</Link>
        {countries.map((c) => (
          <Link key={c.code} href={`/admin/verifications?country=${c.code}`} className={chip(active === c.code)}>
            {countryName(c.code, "en")} ({c.count})
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="p-4 border rounded-lg text-muted-foreground">Nothing waiting.</p>
      ) : (
        <ul className="divide-y border rounded-lg">
          {rows.map((r) => {
            // Someone else has it open, you made its first decision, or it's your own: shown, not openable.
            const note = r.lockedBy ? `Being reviewed by ${r.lockedBy}` : r.recused ? "You gave the first decision; another reviewer must finish" : r.isOwn ? "Your own submission" : null;
            const body = (
              <>
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {r.user.name}
                    {r.duplicate && (
                      <span className="ml-2 bg-destructive/10 px-2 py-0.5 rounded font-semibold text-destructive text-xs">
                        Document used on another account
                      </span>
                    )}
                    {r.awaitingSecond && !r.recused && (
                      <span className="ml-2 bg-surface-feature px-2 py-0.5 border rounded font-semibold text-xs">
                        Needs a second reviewer ({r.firstDecisionBy?.name ?? "someone"} leans {r.firstOutcome === "VERIFIED" ? "approve" : "reject"})
                      </span>
                    )}
                    {r.reopened && (
                      <span className="ml-2 bg-surface-feature px-2 py-0.5 border rounded font-semibold text-xs">Reopened</span>
                    )}
                    {r.claimedByMe && <span className="ml-2 font-semibold text-pin-green-600 text-xs">Yours</span>}
                  </span>
                  <span className="text-muted-foreground text-caption">
                    {countryName(r.countryCode, "en")} · {DOC_LABEL[r.documentType] ?? r.documentType}
                    {note ? ` · ${note}` : ""}
                  </span>
                </span>
                <span className="text-muted-foreground text-caption" title={adminDate(r.waitingSince)}>
                  waiting {ageOf(r.waitingSince)}
                </span>
              </>
            );
            return (
              <li key={r.id}>
                {note ? (
                  <div aria-disabled="true" className="flex flex-wrap justify-between items-center gap-2 opacity-60 px-4 py-3">{body}</div>
                ) : (
                  <Link href={`/admin/verifications/${r.id}`} className="flex flex-wrap justify-between items-center gap-2 px-4 py-3 hover:bg-surface-feature">{body}</Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
