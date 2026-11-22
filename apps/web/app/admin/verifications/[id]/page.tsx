import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getVerificationForReview } from "@/lib/admin-queries";
import { ServiceError } from "@/lib/errors";
import { adminDate, DOC_LABEL } from "@/lib/admin-format";
import { countryName } from "@/lib/countries";
import { isRejectionCode, REJECTION_LABEL } from "@/lib/rejection-reasons";
import ReviewPanel from "@/components/admin/review-panel";

export const metadata: Metadata = { title: "Review ID - Nyeaka admin" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = (await getServerSession())!;
  const { id } = await params;
  const v = await getVerificationForReview(session.user.id, id).catch((e) => {
    if (e instanceof ServiceError && e.code === "NOT_FOUND") notFound();
    throw e;
  });

  const flag = (ok: boolean, good: string, bad: string) => (
    <li className={ok ? "text-muted-foreground" : "font-semibold text-destructive"}>{ok ? `✓ ${good}` : `⚠ ${bad}`}</li>
  );

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <Link href="/admin/verifications" className="text-link text-body-sm hover:underline">← ID reviews</Link>
      <h1 className="text-heading-2">{v.user.name}</h1>

      <dl className="gap-x-6 gap-y-2 grid grid-cols-[max-content_1fr] text-body-sm">
        <dt className="text-muted-foreground">Status</dt><dd className="font-semibold">{v.status}</dd>
        <dt className="text-muted-foreground">Account email</dt><dd>{v.user.email}</dd>
        <dt className="text-muted-foreground">Account created</dt><dd>{adminDate(v.user.createdAt)}</dd>
        <dt className="text-muted-foreground">Country</dt><dd>{countryName(v.countryCode, "en")}</dd>
        <dt className="text-muted-foreground">Document</dt><dd>{DOC_LABEL[v.documentType] ?? v.documentType}</dd>
        <dt className="text-muted-foreground">Name on ID</dt><dd>{v.fullNameOnId}</dd>
        <dt className="text-muted-foreground">Expiry</dt><dd>{v.docExpiry ? adminDate(v.docExpiry).replace(/, \d\d:\d\d UTC/, "") : "Not given"}</dd>
        <dt className="text-muted-foreground">Submitted</dt><dd>{adminDate(v.createdAt)}</dd>
        {v.decidedAt && (<><dt className="text-muted-foreground">Decided</dt><dd>{adminDate(v.decidedAt)}{v.reviewedBy ? ` by ${v.reviewedBy.name}` : ""}</dd></>)}
        {v.rejectionCode && (<><dt className="text-muted-foreground">Reason</dt><dd>{isRejectionCode(v.rejectionCode) ? REJECTION_LABEL[v.rejectionCode] : v.rejectionCode}</dd></>)}
        {v.rejectionReason && (<><dt className="text-muted-foreground">{v.rejectionCode ? "Reviewer note" : "Reason"}</dt><dd>{v.rejectionReason}</dd></>)}
        {v.imagesPurgeAt && !v.imagesPurgedAt && (<><dt className="text-muted-foreground">Images deleted</dt><dd>{adminDate(v.imagesPurgeAt)} (scheduled)</dd></>)}
        {v.imagesPurgedAt && (<><dt className="text-muted-foreground">Images deleted</dt><dd>{adminDate(v.imagesPurgedAt)}</dd></>)}
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-4">Name check</h2>
        <div className={`gap-px grid grid-cols-2 border rounded-lg overflow-hidden text-body-sm ${v.nameMatches ? "" : "border-destructive"}`}>
          <div className="bg-surface-feature p-3"><span className="block text-muted-foreground text-caption">Name on the ID</span><strong>{v.fullNameOnId}</strong></div>
          <div className="bg-surface-feature p-3"><span className="block text-muted-foreground text-caption">Account name</span><strong>{v.user.name}</strong></div>
        </div>
        <p className={v.nameMatches ? "text-muted-foreground text-body-sm" : "font-semibold text-destructive text-body-sm"}>
          {v.nameMatches ? "✓ Names match (ignoring case, spaces and punctuation)" : "⚠ Names differ. Check the document itself before deciding."}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-4">Automatic checks</h2>
        <ul className="text-body-sm">
          {flag(v.nameMatches, "Name on ID matches the account name", `Name on ID differs from the account name (“${v.user.name}”)`)}
          {flag(v.countryMatches, "ID country matches the account country", "ID country differs from the account country")}
          {flag(v.duplicates.length === 0, "Document not seen on another account", `Same document number on ${v.duplicates.length} other account(s)`)}
        </ul>
        {v.duplicates.length > 0 && (
          <ul className="divide-y border rounded-lg text-body-sm">
            {v.duplicates.map((d) => (
              <li key={d.id}>
                <Link href={`/admin/verifications/${d.id}`} className="flex justify-between px-4 py-2 hover:bg-surface-feature">
                  <span>{d.user.name} · {d.status}</span>
                  <span className="text-muted-foreground">{adminDate(d.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-4">Checklist for {countryName(v.countryCode, "en")}</h2>
        <ul className="pl-5 text-body-sm list-disc">
          {v.checklist.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </section>

      <ReviewPanel
        id={v.id}
        status={v.status}
        isOwn={v.isOwn}
        imagesDeleted={!!v.imagesPurgedAt}
        hasBack={v.hasBack}
      />
    </div>
  );
}
