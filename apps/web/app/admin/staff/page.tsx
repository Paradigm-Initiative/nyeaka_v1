import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { isAdmin } from "@/lib/admin";
import { listStaff } from "@/lib/staff";
import { listOpenInvites, staffDomains } from "@/lib/staff-invites";
import { adminDate } from "@/lib/admin-format";
import StaffManager from "@/components/admin/staff-manager";

export const metadata: Metadata = { title: "Staff - Nyeaka admin" };
export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const session = (await getServerSession())!;
  if (!(await isAdmin(session.user.id))) notFound(); // admin only
  const [staff, invites] = await Promise.all([listStaff(session.user.id), listOpenInvites(session.user.id)]);
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-heading-2">Staff</h1>
      <StaffManager
        meId={session.user.id}
        domains={staffDomains()}
        staff={staff.map((s) => ({ ...s, lastLogin: s.lastLogin ? adminDate(s.lastLogin) : null }))}
        invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, invitedBy: i.invitedBy.name, expires: adminDate(i.expiresAt) }))}
      />
    </div>
  );
}
