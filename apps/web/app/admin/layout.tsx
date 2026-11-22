import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getStaffAccess } from "@/lib/admin";
import AdminNav from "@/components/admin/admin-nav";

// Everything under /admin is for staff only (admins and reviewers), and English only for
// now. Anyone else gets a plain 404, so the area's existence isn't revealed. Admin-only
// pages 404 for reviewers too. Every admin server action re-checks the tier itself
// (lib/admin.ts: assertStaff / assertAdminOnly); this is not the only guard.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  // A stale cookie (the session was deleted when staff were removed or their two-factor was
  // reset) goes to sign-in. The proxy already 404s anyone with no cookie at all.
  if (!session) redirect("/sign-in?callbackUrl=/admin");
  const access = await getStaffAccess(session.user.id);
  if (!access) notFound();
  // Two-factor must be on before anything in /admin opens (the actions check it again).
  if (!access.twoFactor) redirect("/two-factor/setup");
  const staffRole = access.role;
  return (
    <div className="section-wrapper">
      <AdminNav staffRole={staffRole} />
      {children}
    </div>
  );
}
