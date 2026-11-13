import { describe, expect, it } from "vitest";
import {
  matchCancelledEmail,
  offerAcceptedEmail,
  offerNotSelectedEmail,
  offerReceivedEmail,
  resetPasswordEmail,
  restrictedUserEmail,
  verificationEmail,
} from "@/lib/email-templates";
import { emailLocale, emailTranslator } from "@/lib/email-i18n";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import pt from "@/messages/pt.json";

const base = { firstName: "Ada", listingTitle: "Dell <b>5490</b>", requestTitle: "School laptop", url: "https://x.test/d" };
const all = (locale?: string) => [
  verificationEmail("Ada", "https://x.test/v", locale),
  resetPasswordEmail("Ada", "https://x.test/r", locale),
  restrictedUserEmail("Ada", "help@x.test", locale),
  restrictedUserEmail("Ada", undefined, locale),
  offerReceivedEmail({ ...base, from: "Bo", kind: "donor-offer", locale }),
  offerReceivedEmail({ ...base, from: "Bo", kind: "requester-ask", locale }),
  offerAcceptedEmail({ ...base, accepter: "Bo", locale }),
  offerNotSelectedEmail({ ...base, role: "donor", locale }),
  offerNotSelectedEmail({ ...base, role: "requester", locale }),
  matchCancelledEmail({ ...base, canceller: "Bo", role: "donor", locale }),
  matchCancelledEmail({ ...base, canceller: "Bo", role: "requester", locale }),
];

describe("email languages", () => {
  it("picks the recipient's language, English when unknown", () => {
    expect(emailLocale("fr")).toBe("fr");
    expect(emailLocale("pt")).toBe("pt");
    for (const v of [undefined, null, "", "xx", 5]) expect(emailLocale(v)).toBe("en");
  });

  it("every email renders in every language with no unresolved {placeholders} or markup", () => {
    for (const locale of ["en", "fr", "pt", undefined, "xx"])
      for (const m of all(locale)) {
        expect(m.subject.length).toBeGreaterThan(3);
        const text = m.html.replace(/<[^>]*>/g, " "); // subjects are plain text and may carry a raw title
        expect(m.subject).not.toMatch(/[{}]|emails\./);
        expect(text).not.toMatch(/[{}<>]|emails\./); // unresolved placeholders, broken tags, raw keys
      }
  });

  it("French and Portuguese emails are not English", () => {
    const f = all("fr"), p = all("pt"), e = all("en");
    f.forEach((m, i) => expect(m.subject).not.toBe(e[i].subject));
    p.forEach((m, i) => expect(m.subject).not.toBe(e[i].subject));
    expect(f[0].subject).toBe("Confirmez votre adresse e-mail pour Nyeaka");
    expect(p[0].subject).toBe("Confirme o seu e-mail na Nyeaka");
    expect(f[0].html).toContain('lang="fr"');
    expect(f[0].html).toContain("Si le bouton ne fonctionne pas");
    expect(p[4].html).toContain("Abra o seu painel");
  });

  it("still escapes user text in every language, and keeps accents intact", () => {
    for (const locale of ["en", "fr", "pt"]) {
      const html = offerReceivedEmail({ ...base, from: "Bo", kind: "donor-offer", locale }).html;
      expect(html).not.toContain("<b>5490</b>");
      expect(html).toContain("Dell &lt;b&gt;5490&lt;/b&gt;");
      expect(html).toContain('<meta charset="utf-8">');
    }
    expect(restrictedUserEmail("Ada", undefined, "fr").html).toContain("À la suite de signalements");
  });

  it("an apostrophe next to a value doesn't swallow it (ICU quoting)", () => {
    const html = offerNotSelectedEmail({ ...base, role: "requester", locale: "fr" }).html;
    expect(html).toContain("l'appareil <strong>Dell &lt;b&gt;5490&lt;/b&gt;</strong> que vous aviez demandé");
  });

  it("the three catalogues have the same email keys", () => {
    const keys = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "string" ? [p + k] : keys(v, `${p}${k}.`)));
    const e = keys(en.emails).sort();
    expect(keys(fr.emails).sort()).toEqual(e);
    expect(keys(pt.emails).sort()).toEqual(e);
  });

  it("translator exposes the locale it used", () => {
    expect(emailTranslator("pt").locale).toBe("pt");
  });
});
