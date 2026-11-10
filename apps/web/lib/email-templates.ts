/** Escape user-supplied text before it goes into an HTML email. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(heading: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:480px;">
      <tr><td>
        <p style="margin:0 0 16px;font-weight:bold;font-size:18px;">Nyeaka</p>
        <h1 style="margin:0 0 12px;font-size:22px;">${heading}</h1>
        <p style="margin:0 0 24px;line-height:1.5;">${body}</p>
        ${
          cta
            ? `<a href="${cta.url}" style="display:inline-block;background:#2f7a4d;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${cta.label}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>`
            : ""
        }
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function verificationEmail(firstName: string, url: string) {
  return {
    subject: "Verify your email for Nyeaka",
    html: layout(
      `Welcome, ${firstName}`,
      "Confirm your email address to finish setting up your Nyeaka account. This link expires in 1 hour. If you didn't sign up, you can ignore this email.",
      { label: "Verify my email", url },
    ),
  };
}

export function resetPasswordEmail(firstName: string, url: string) {
  return {
    subject: "Reset your Nyeaka password",
    html: layout(
      `Hi ${firstName}, reset your password`,
      "We received a request to reset your password. This link expires in 1 hour. If you didn't ask for this, you can ignore this email and your password will stay the same.",
      { label: "Choose a new password", url },
    ),
  };
}

export interface Person {
  id: string;
  name: string;
  email: string;
}

/** To the admin: someone reported someone. All user-supplied text is escaped. */
export function reportEmail(d: {
  reporter: Person;
  reported: Person;
  target: string;
  reason: string;
  details?: string;
  openReports: number;
}) {
  const who = (p: Person) => `${esc(p.name)} &lt;${esc(p.email)}&gt; (id ${esc(p.id)})`;
  return {
    subject: `[Nyeaka] Report: ${d.reason} - ${d.reported.name}`,
    html: layout(
      "New report",
      `<strong>Reported:</strong> ${who(d.reported)}<br>
<strong>By:</strong> ${who(d.reporter)}<br>
<strong>About:</strong> ${esc(d.target)}<br>
<strong>Reason:</strong> ${esc(d.reason)}<br>
<strong>Details:</strong> ${d.details ? esc(d.details) : "none given"}<br><br>
${esc(d.reported.name)} now has ${d.openReports} report${d.openReports === 1 ? "" : "s"} from different people.`,
    ),
  };
}

/** To the admin: an account was restricted automatically. */
export function restrictionAdminEmail(d: { user: Person; reason: string }) {
  return {
    subject: `[Nyeaka] Account restricted: ${d.user.name}`,
    html: layout(
      "Account restricted automatically",
      `${esc(d.user.name)} &lt;${esc(d.user.email)}&gt; (id ${esc(d.user.id)}) can no longer post listings, requests or offers.<br><br>
<strong>Why:</strong> ${esc(d.reason)}<br><br>
Review their reports, then either dismiss the reports and clear <code>restrictedAt</code> on the user, or leave the restriction in place.`,
    ),
  };
}

/** To the restricted user. Says what changed and how to ask for a review. */
export function restrictedUserEmail(firstName: string, contact?: string) {
  return {
    subject: "Your Nyeaka account has been restricted",
    html: layout(
      `Hi ${esc(firstName)}, your account is restricted`,
      `Because of reports from other members, you can't post new listings, requests or offers while we review your account. You can still sign in, browse and finish any matches you already have.<br><br>${
        contact
          ? `If you think this is a mistake, write to us at ${esc(contact)} and we will look at it.`
          : "If you think this is a mistake, contact the Nyeaka team and we will look at it."
      }`,
    ),
  };
}
