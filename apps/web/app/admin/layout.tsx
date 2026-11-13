import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { isAdmin } from "@/lib/admin";
import AdminNav from "@/components/admin/admin-nav";

// Everything under /admin is for admins only, and English only for now. Anyone else
// gets a plain 404, so the area's existence isn't revealed. Every admin server action
// re-checks the role itself (lib/admin.ts: assertAdmin); this is not the only guard.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session || !(await isAdmin(session.user.id))) notFound();
  return (
    <div className="section-wrapper">
      <AdminNav />
      {children}
    </div>
  );
}
