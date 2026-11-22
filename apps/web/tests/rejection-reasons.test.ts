import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import pt from "@/messages/pt.json";
import { verificationRejectedEmail } from "@/lib/email-templates";
import { REJECTION_CODES, REJECTION_LABEL, isRejectionCode } from "@/lib/rejection-reasons";

const catalogues = { en, fr, pt };

describe("reject reason presets", () => {
  it("every code has reviewer text and pre-written text in en, fr and pt (email and /verify page)", () => {
    for (const code of REJECTION_CODES) {
      expect(REJECTION_LABEL[code]).toBeTruthy();
      for (const [lang, c] of Object.entries(catalogues)) {
        expect(c.emails.verificationRejected.reasons[code], `${lang} email ${code}`).toBeTruthy();
        expect(c.verify.rejectReasons[code], `${lang} verify ${code}`).toBeTruthy();
      }
    }
  });

  it("the email uses the preset text in the applicant's language, not free text", () => {
    const mail = verificationRejectedEmail({ firstName: "Awa", code: "EXPIRED", reason: "<b>secret staff note</b>", url: "https://x.test/verify", locale: "fr" });
    expect(mail.html).toContain(fr.emails.verificationRejected.reasons.EXPIRED);
    expect(mail.html).not.toContain("secret staff note");
    const mailEn = verificationRejectedEmail({ firstName: "Awa", code: "SELFIE_MISMATCH", url: "https://x.test/verify" });
    expect(mailEn.html).toContain(en.emails.verificationRejected.reasons.SELFIE_MISMATCH);
  });

  it("an old row with no code still shows its own text, escaped", () => {
    const mail = verificationRejectedEmail({ firstName: "Awa", code: null, reason: "Blurry <i>photo</i>", url: "https://x.test/verify" });
    expect(mail.html).toContain("Blurry &lt;i&gt;photo&lt;/i&gt;");
  });

  it("only known codes are accepted", () => {
    expect(isRejectionCode("BLURRY")).toBe(true);
    expect(isRejectionCode("blurry")).toBe(false);
    expect(isRejectionCode(undefined)).toBe(false);
  });
});
