import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { isAdmin } from "@/lib/admin";
import { getCountries } from "@/lib/countries";
import { getEnabledCountryCodes } from "@/lib/enabled-countries";
import CountryToggle from "@/components/admin/country-toggle";

export const metadata: Metadata = { title: "Countries - Nyeaka admin" };
export const dynamic = "force-dynamic";

export default async function AdminCountriesPage() {
  // Admin only: reviewers get a 404 here, as for any page they have no link to.
  const session = await getServerSession();
  if (!session || !(await isAdmin(session.user.id))) notFound();
  const enabled = await getEnabledCountryCodes();
  const countries = getCountries("en");
  const on = countries.filter((c) => enabled.includes(c.code));
  const off = countries.filter((c) => !enabled.includes(c.code));

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <header className="flex flex-col gap-2">
        <h1 className="text-heading-2">Countries</h1>
        <p className="text-body-md text-muted-foreground">
          People can only sign up, post and send offers in an enabled country, and offers only work between people in
          the same country. Switching a country off stops new sign-ups and posting there; posts, chats and matches that
          already exist stay visible. Changes can take up to a minute to reach every server.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-3">Enabled ({on.length})</h2>
        <ul className="flex flex-col divide-y border rounded-lg">
          {on.map((c) => (
            <li key={c.code} className="flex justify-between items-center gap-3 px-4 py-3">
              <span>
                {c.name} <span className="text-muted-foreground text-caption">{c.code}</span>
              </span>
              <CountryToggle code={c.code} name={c.name} enabled disabledReason={on.length <= 1 ? "At least one country must stay enabled." : undefined} />
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-3">Not enabled ({off.length})</h2>
        <ul className="flex flex-col divide-y border rounded-lg">
          {off.map((c) => (
            <li key={c.code} className="flex justify-between items-center gap-3 px-4 py-3">
              <span>
                {c.name} <span className="text-muted-foreground text-caption">{c.code}</span>
              </span>
              <CountryToggle code={c.code} name={c.name} enabled={false} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
