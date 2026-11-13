import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { getServerSession } from "@/lib/get-session";
import { getPublicProfile } from "@/lib/profile";
import { countryName } from "@/lib/countries";
import ReportPanel from "@/components/safety/report-panel";
import BlockButton from "@/components/safety/block-button";
import UnblockButton from "@/components/safety/unblock-button";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: `${t("title")} - Nyeaka` };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession();
  const [p, t, format, locale] = await Promise.all([
    getPublicProfile(id, session?.user.id),
    getTranslations("profile"),
    getFormatter(),
    getLocale(),
  ]);
  if (!p) notFound();

  return (
    <div className="flex flex-col gap-6 mx-auto py-8 max-w-2xl section-wrapper">
      <header className="flex items-center gap-4">
        <span className="flex justify-center items-center bg-pin-green-50 rounded-full size-16 font-heading font-bold text-pin-green-600 text-2xl">
          {p.firstName[0]?.toUpperCase()}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-heading-2">{p.displayName}</h1>
          <p className="text-muted-foreground text-body-sm">
            {countryName(p.countryCode, locale)} · {t("memberSince", { date: format.dateTime(p.memberSince, { year: "numeric", month: "long" }) })}
          </p>
          <span className={p.verified ? "badge badge-green self-start" : "badge self-start"}>
            {p.verified ? t("verified") : t("notVerified")}
          </span>
        </div>
      </header>

      <section className="gap-4 grid grid-cols-2 p-4 border rounded-lg">
        <div>
          <span className="block text-heading-3">{p.reputation.rating !== null ? `${p.reputation.rating.toFixed(1)} ★` : "–"}</span>
          <span className="text-muted-foreground text-body-sm">
            {p.reputation.ratingCount > 0 ? t("ratingCount", { count: p.reputation.ratingCount }) : t("noRatings")}
          </span>
        </div>
        <div>
          <span className="block text-heading-3">{p.reputation.handoffs}</span>
          <span className="text-muted-foreground text-body-sm">{t("handoffs", { count: p.reputation.handoffs })}</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-heading-4">{t("reviews")}</h2>
        {p.comments.length === 0 ? (
          <p className="text-muted-foreground text-body-sm">{t("noReviews")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {p.comments.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 p-4 border rounded-lg">
                <span className="font-semibold text-body-sm">
                  <span aria-label={t("stars", { count: c.score })}>{"★".repeat(c.score)}{"☆".repeat(5 - c.score)}</span>
                  <span className="ml-2 font-normal text-muted-foreground">
                    {c.by ? t("by", { name: c.by }) : t("byDeleted")} · {format.dateTime(c.createdAt, { dateStyle: "medium" })}
                  </span>
                </span>
                <p className="text-body-md text-pretty break-words whitespace-pre-wrap">{c.comment}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.isSelf ? (
        <div className="flex flex-wrap gap-4 text-body-sm">
          <Link href="/dashboard" className="text-link hover:underline">{t("toDashboard")}</Link>
          <Link href="/settings" className="text-link hover:underline">{t("settings")}</Link>
        </div>
      ) : (
        p.canReport && (
          <div className="flex flex-wrap items-start gap-2">
            <ReportPanel targetType="USER" targetId={p.id} who={p.firstName} />
            {p.blockedByMe ? <UnblockButton userId={p.id} who={p.firstName} /> : <BlockButton userId={p.id} who={p.firstName} />}
          </div>
        )
      )}
    </div>
  );
}
