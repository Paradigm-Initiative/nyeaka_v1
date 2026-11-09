function layout(heading: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:480px;">
      <tr><td>
        <p style="margin:0 0 16px;font-weight:bold;font-size:18px;">Nyeaka</p>
        <h1 style="margin:0 0 12px;font-size:22px;">${heading}</h1>
        <p style="margin:0 0 24px;line-height:1.5;">${body}</p>
        <a href="${cta.url}" style="display:inline-block;background:#2f7a4d;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${cta.label}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>
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
