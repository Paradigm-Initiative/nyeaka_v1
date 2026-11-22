"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteStaffAction, resetTwoFactorAction, revokeInviteAction, setStaffRoleAction } from "@/actions/admin";

type Role = "ADMIN" | "REVIEWER";
type Member = { id: string; name: string; email: string; staffRole: Role; twoFactorEnabled: boolean; lastLogin: string | null };
type Invite = { id: string; email: string; role: Role; invitedBy: string; expires: string };

/** Admin only, English only. Invite staff, remove them, reset a locked-out person's two-factor. */
export default function StaffManager({ meId, domains, staff, invites }: { meId: string; domains: string[]; staff: Member[]; invites: Invite[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("REVIEWER");
  const [link, setLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const done = (msg: string) => (res: { ok: boolean; error?: string }) => {
    if (!res.ok) return void toast.error(res.error);
    toast.success(msg);
    router.refresh();
  };

  const invite = () =>
    start(async () => {
      const res = await inviteStaffAction(email, role);
      if (!res.ok) return void toast.error(res.error);
      setEmail("");
      setLink(res.data.url);
      toast.success(res.data.emailed ? "Invite emailed." : "The email could not be sent. Copy the link below instead.");
      router.refresh();
    });

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-heading-4">Invite someone</h2>
        {domains.length === 0 ? (
          <p className="text-body-sm text-destructive">Invites are off: set STAFF_EMAIL_DOMAINS (for example &quot;pin.org&quot;).</p>
        ) : (
          <p className="text-muted-foreground text-body-sm">Only addresses at {domains.join(", ")}. The link works once and expires in 72 hours.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Input type="email" aria-label="Email" placeholder="name@domain" value={email} onChange={(e) => setEmail(e.target.value)} className="max-w-xs" />
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)} className="px-2 border rounded-md text-body-sm">
            <option value="REVIEWER">Reviewer</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Button disabled={pending || !email || domains.length === 0} onClick={invite}>{pending ? "Sending…" : "Send invite"}</Button>
        </div>
        {link && (
          <p className="p-3 border rounded-lg text-body-sm break-all">
            Invite link (shown once): <code>{link}</code>
          </p>
        )}
      </section>

      {invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-heading-4">Open invites</h2>
          <ul className="divide-y border rounded-lg text-body-sm">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap justify-between items-center gap-2 px-4 py-2">
                <span>{i.email} · {i.role === "ADMIN" ? "Admin" : "Reviewer"} · expires {i.expires}</span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => done("Invite cancelled.")(await revokeInviteAction(i.id)))}>Cancel</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-heading-4">Current staff</h2>
        <ul className="divide-y border rounded-lg text-body-sm">
          {staff.map((m) => (
            <li key={m.id} className="flex flex-wrap justify-between items-center gap-2 px-4 py-3">
              <span>
                <strong>{m.name}</strong> · {m.email}
                <span className="block text-muted-foreground text-caption">
                  {m.staffRole === "ADMIN" ? "Admin" : "Reviewer"} · two-factor {m.twoFactorEnabled ? "on" : "not set up"}
                  {m.lastLogin ? ` · last sign-in ${m.lastLogin}` : ""}
                </span>
              </span>
              {m.id === meId ? (
                <span className="text-muted-foreground text-caption">You</span>
              ) : confirm === m.id ? (
                <span className="flex items-center gap-2">
                  <span className="text-caption">Remove access and sign them out?</span>
                  <Button size="sm" variant="destructive" disabled={pending} onClick={() => start(async () => { setConfirm(null); done("Removed. Their sessions have ended.")(await setStaffRoleAction(m.id, null)); })}>Remove</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>Keep</Button>
                </span>
              ) : (
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => done("Two-factor reset. They must set it up again.")(await resetTwoFactorAction(m.id)))}>Reset two-factor</Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => setConfirm(m.id)}>Remove…</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
