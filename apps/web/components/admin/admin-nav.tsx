import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/verifications", label: "ID reviews" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/countries", label: "Countries" },
  { href: "/admin/log", label: "Activity log" },
];

/** Admin only, English only. */
export default function AdminNav() {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-4 mb-6 pb-3 border-b">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="font-semibold text-body-sm hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
