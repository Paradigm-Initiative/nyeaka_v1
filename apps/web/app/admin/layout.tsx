import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getStaffRole } from "@/lib/admin";
import AdminNav from "@/components/admin/admin-nav";

// Everything under /admin is for staff only (admins and reviewers), and English only for
// now. Anyone else gets a plain 404, so the area's existence isn't revealed. Admin-only
// pages 404 for reviewers too. Every admin server action re-checks the tier itself
// (lib/admin.ts: assertStaff / assertAdminOnly); this is not the only guard.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const staffRole = session ? await getStaffRole(session.user.id) : null;
  if (!staffRole) notFound();
  return (
    <div className="section-wrapper">
      <AdminNav staffRole={staffRole} />
      {children}
    </div>
  );
}
