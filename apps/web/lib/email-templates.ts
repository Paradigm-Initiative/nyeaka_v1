import { emailTranslator } from "./email-i18n";

/** Escape user-supplied text before it goes into an HTML email. */
export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(heading: string, body: string, cta?: { label: string; url: string }, locale?: string) {
  const { locale: lang, t } = emailTranslator(locale);
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"></head><body style="margin:0;background:#f6f5f1;font-family:Arial,Helvetica,sans-serif;color:#1f2a24;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px;max-width:480px;">
      <tr><td>
        <p style="margin:0 0 16px;font-weight:bold;font-size:18px;">Nyeaka</p>
        <h1 style="margin:0 0 12px;font-size:22px;">${heading}</h1>
        <p style="margin:0 0 24px;line-height:1.5;">${body}</p>
        ${
          cta
            ? `<a href="${cta.url}" style="display:inline-block;background:#2f7a4d;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;">${cta.label}</a>
        <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.5;">${t("common.fallback")}<br>${cta.url}</p>`
            : ""
        }
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function verificationEmail(firstName: string, url: string, locale?: string) {
  const { t } = emailTranslator(locale);
  return {
    subject: t("verification.subject"),
    html: layout(
      t("verification.heading", { firstName }),
      t("verification.body"),
      { label: t("verification.cta"), url },
      locale,
    ),
  };
}

export function resetPasswordEmail(firstName: string, url: string, locale?: string) {
  const { t } = emailTranslator(locale);
  return {
    subject: t("reset.subject"),
    html: layout(
      t("reset.heading", { firstName }),
      t("reset.body"),
      { label: t("reset.cta"), url },
      locale,
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
export function restrictedUserEmail(firstName: string, contact?: string, locale?: string) {
  const { t } = emailTranslator(locale);
  return {
    subject: t("restricted.subject"),
    html: layout(
      t("restricted.heading", { firstName: esc(firstName) }),
      `${t("restricted.body")}<br><br>${
        contact ? t("restricted.contact", { contact: esc(contact) }) : t("restricted.noContact")
      }`,
      undefined,
      locale,
    ),
  };
}

// ---- offers and matches ---------------------------------------------------------
// These never include phone numbers or message text: the email only says that
// something happened and links back to the app, where access is checked.

/** To whoever must answer a new offer. `kind` says who sent it. */
export function offerReceivedEmail(d: {
  firstName: string;
  from: string;
  kind: "donor-offer" | "requester-ask";
  listingTitle: string;
  requestTitle: string;
  url: string;
  locale?: string;
}) {
  const { t, html } = emailTranslator(d.locale);
  const asked = d.kind === "requester-ask";
  const v = {
    firstName: esc(d.firstName),
    from: esc(d.from),
    listingTitle: esc(d.listingTitle),
    requestTitle: esc(d.requestTitle),
  };
  return {
    subject: t(asked ? "offerReceived.subjectAsk" : "offerReceived.subjectOffer", {
      from: d.from,
      listingTitle: d.listingTitle,
    }),
    html: layout(
      t(asked ? "offerReceived.headingAsk" : "offerReceived.headingOffer", { from: v.from }),
      html(asked ? "offerReceived.bodyAsk" : "offerReceived.bodyOffer", v),
      { label: t("offerReceived.cta"), url: d.url },
      d.locale,
    ),
  };
}

/** To the person whose offer was accepted. */
export function offerAcceptedEmail(d: {
  firstName: string;
  accepter: string;
  listingTitle: string;
  url: string;
  locale?: string;
}) {
  const { t, html } = emailTranslator(d.locale);
  return {
    subject: t("offerAccepted.subject", { accepter: d.accepter }),
    html: layout(
      t("offerAccepted.heading"),
      html("offerAccepted.body", {
        firstName: esc(d.firstName),
        accepter: esc(d.accepter),
        listingTitle: esc(d.listingTitle),
      }),
      { label: t("offerAccepted.cta"), url: d.url },
      d.locale,
    ),
  };
}

/** To someone whose offer was closed because the device or request went elsewhere. */
export function offerNotSelectedEmail(d: {
  firstName: string;
  role: "donor" | "requester";
  listingTitle: string;
  requestTitle: string;
  url: string;
  locale?: string;
}) {
  const { t, html } = emailTranslator(d.locale);
  const r = d.role === "donor" ? "Donor" : "Requester";
  return {
    subject: t(`notSelected.subject${r}`),
    html: layout(
      t(`notSelected.heading${r}`),
      html(`notSelected.body${r}`, {
        firstName: esc(d.firstName),
        listingTitle: esc(d.listingTitle),
        requestTitle: esc(d.requestTitle),
      }),
      { label: t(`notSelected.cta${r}`), url: d.url },
      d.locale,
    ),
  };
}

/** To the other person when someone cancels a match. */
export function matchCancelledEmail(d: {
  firstName: string;
  canceller: string;
  role: "donor" | "requester";
  listingTitle: string;
  requestTitle: string;
  url: string;
  locale?: string;
}) {
  const { t, html } = emailTranslator(d.locale);
  const r = d.role === "donor" ? "Donor" : "Requester";
  return {
    subject: t("matchCancelled.subject", { canceller: d.canceller }),
    html: layout(
      t("matchCancelled.heading"),
      `${html("matchCancelled.body", {
        firstName: esc(d.firstName),
        canceller: esc(d.canceller),
        listingTitle: esc(d.listingTitle),
      })} ${html(`matchCancelled.tail${r}`, { requestTitle: esc(d.requestTitle) })}`,
      { label: t("matchCancelled.cta"), url: d.url },
      d.locale,
    ),
  };
}
