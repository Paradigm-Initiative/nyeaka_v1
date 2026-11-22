import Link from "next/link";
import type { StaffRole } from "@/lib/admin";

// Reviewers get the ID queue and reports; the rest is admin-only.
const LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/verifications", label: "ID reviews" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/countries", label: "Countries", adminOnly: true },
  { href: "/admin/staff", label: "Staff", adminOnly: true },
  { href: "/admin/log", label: "Activity log", adminOnly: true },
];

/** Staff only, English only. */
export default function AdminNav({ staffRole }: { staffRole: StaffRole }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-4 mb-6 pb-3 border-b">
      {LINKS.filter((l) => !l.adminOnly || staffRole === "ADMIN").map((l) => (
        <Link key={l.href} href={l.href} className="font-semibold text-body-sm hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
