"use client";

import { isRejectionCode } from "@/lib/rejection-reasons";
import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { VerificationStatus } from "@/generated/prisma/client";
import { submitVerificationAction } from "@/actions/verification";
import { stripImageMetadata } from "@/lib/strip-image-metadata";
import { useErrorText } from "@/lib/use-error-text";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import FormError from "../post/form-error";

type DocType = "NATIONAL_ID" | "PASSPORT" | "DRIVERS_LICENSE" | "VOTERS_CARD" | "RESIDENCE_PERMIT";
type Slot = "frontKey" | "backKey" | "selfieKey";
type Photo = { key: string; preview: string };

const ACCEPT = "image/jpeg,image/png,image/webp";

type Props = {
  purpose: "list" | "request";
  status: VerificationStatus;
  countryName: string;
  docTypes: DocType[];
  defaultName: string;
  rejectionReason: string | null;
  rejectionCode: string | null;
};

const VerifyForm = ({ purpose, status, countryName, docTypes, defaultName, rejectionReason, rejectionCode }: Props) => {
  const t = useTranslations("verify");
  const errText = useErrorText();
  const router = useRouter();

  const [documentType, setDocumentType] = useState<DocType | "">("");
  const [fullNameOnId, setFullNameOnId] = useState(defaultName);
  const [docNumber, setDocNumber] = useState("");
  const [docExpiry, setDocExpiry] = useState("");
  const [photos, setPhotos] = useState<Partial<Record<Slot, Photo>>>({});
  const [uploading, setUploading] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  const heading = t(purpose === "list" ? "headingList" : "headingRequest");
  const reason = t(purpose === "list" ? "reasonList" : "reasonRequest");

  if (status === "PENDING" || status === "VERIFIED") {
    const done = status === "VERIFIED";
    return (
      <div className="flex flex-col gap-5 mx-auto py-8 max-w-2xl">
        <h1 className="text-heading-2 text-pretty">{t(done ? "verifiedTitle" : "pendingTitle")}</h1>
        <p className="text-muted-foreground text-body-lg text-pretty">{t(done ? "verifiedBody" : "pendingBody")}</p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/dashboard">{t("toDashboard")}</Link>
          </Button>
          {!done && (
            <Button variant="outline" size="lg" asChild>
              <Link href="/listings">{t("keepBrowsing")}</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  const needsBack = !!documentType && documentType !== "PASSPORT";

  async function pick(slot: Slot, file: File | undefined) {
    if (!file) return;
    setFormError(undefined);
    setErrors((e) => ({ ...e, [slot]: "" }));
    if (!ACCEPT.split(",").includes(file.type)) return setErrors((e) => ({ ...e, [slot]: errText("uploadType")! }));
    setUploading(slot);
    try {
      // Re-encoding drops EXIF (location, device) before anything leaves the phone.
      const clean = await stripImageMetadata(file);
      const presign = await fetch("/api/uploads/id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: clean.type, size: clean.size }),
      });
      const body = await presign.json();
      if (!presign.ok) throw new Error(body.error ?? "uploadFailed");
      const put = await fetch(body.uploadUrl, { method: "PUT", headers: { "Content-Type": clean.type }, body: clean });
      if (!put.ok) throw new Error("uploadFailed");
      setPhotos((p) => {
        if (p[slot]) URL.revokeObjectURL(p[slot].preview);
        return { ...p, [slot]: { key: body.key as string, preview: URL.createObjectURL(clean) } };
      });
    } catch (e) {
      setErrors((er) => ({ ...er, [slot]: errText(e instanceof Error ? e.message : "uploadFailed")! }));
    } finally {
      setUploading(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(undefined);
    setSubmitting(true);
    const res = await submitVerificationAction({
      documentType,
      fullNameOnId,
      docNumber,
      docExpiry,
      frontKey: photos.frontKey?.key ?? "",
      backKey: needsBack ? photos.backKey?.key : undefined,
      selfieKey: photos.selfieKey?.key ?? "",
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success(t("submitted"));
      router.refresh();
      return;
    }
    setErrors(errText.fields(res.fieldErrors));
    setFormError(errText(res.error));
  }

  const photoSlot = (slot: Slot, label: string) => {
    const photo = photos[slot];
    return (
      <div className="flex flex-col flex-1 gap-1.5 min-w-40">
        <Label htmlFor={slot}>{label}</Label>
        <label
          htmlFor={slot}
          className="flex flex-col justify-center items-center bg-surface-feature border border-hairline-strong border-dashed rounded-sm min-h-32 overflow-hidden text-muted-foreground text-body-sm text-center cursor-pointer"
        >
          {photo ? (
            <Image src={photo.preview} alt={label} width={240} height={160} unoptimized className="w-full h-32 object-cover" />
          ) : uploading === slot ? (
            t("uploading")
          ) : (
            t("choosePhoto")
          )}
        </label>
        <input
          id={slot}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={uploading !== null || submitting}
          onChange={(ev) => {
            void pick(slot, ev.target.files?.[0]);
            ev.target.value = "";
          }}
        />
        {photo && <span className="text-muted-foreground text-xs">{t("replacePhoto")}</span>}
        <FormError message={errors[slot]} />
      </div>
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 mx-auto py-8 max-w-2xl">
      <h1 className="text-heading-2 text-pretty">{status === "FAILED" ? t("failedTitle") : heading}</h1>
      <p className="text-muted-foreground text-body-lg text-pretty">
        {status === "FAILED" ? t("failedBody") : reason}
      </p>
      {status === "FAILED" && (rejectionCode || rejectionReason) && (
        <p role="status" className="bg-surface-feature p-3 rounded-lg font-semibold text-body-sm">
          {t("failedReason", { reason: isRejectionCode(rejectionCode) ? t(`rejectReasons.${rejectionCode}`) : (rejectionReason ?? "") })}
        </p>
      )}

      <div className="bg-surface-feature p-4 rounded-lg text-body-sm">
        <p className="font-heading font-semibold">{t("noticeTitle")}</p>
        <p className="mt-1">{t("noticeBody")}</p>
      </div>

      <div className="flex flex-col gap-4 p-4 border rounded-lg">
        <p className="text-muted-foreground text-body-sm">{t("country", { country: countryName })}</p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="documentType">{t("docType")}</Label>
          <Select value={documentType || undefined} onValueChange={(v) => setDocumentType(v as DocType)}>
            <SelectTrigger id="documentType" size="lg" className="rounded-sm" aria-invalid={!!errors.documentType}>
              <SelectValue placeholder={t("docTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {docTypes.map((d) => (
                <SelectItem key={d} value={d}>
                  {t(`docTypes.${d}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormError message={errors.documentType} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullNameOnId">{t("fullName")}</Label>
          <Input id="fullNameOnId" className="h-13 rounded-sm" value={fullNameOnId} autoComplete="name" onChange={(e) => setFullNameOnId(e.target.value)} />
          <span className="text-muted-foreground text-xs">{t("fullNameHint")}</span>
          <FormError message={errors.fullNameOnId} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="docNumber">{t("docNumber")}</Label>
          <Input id="docNumber" className="h-13 rounded-sm" value={docNumber} autoComplete="off" placeholder={t("docNumberPlaceholder")} onChange={(e) => setDocNumber(e.target.value)} />
          <span className="text-muted-foreground text-xs">{t("docNumberHint")}</span>
          <FormError message={errors.docNumber} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="docExpiry">{t("docExpiry")}</Label>
          <Input id="docExpiry" type="date" className="h-13 rounded-sm" value={docExpiry} onChange={(e) => setDocExpiry(e.target.value)} />
          <FormError message={errors.docExpiry} />
        </div>

        <div className="flex flex-wrap gap-3">
          {photoSlot("frontKey", t("front"))}
          {needsBack && photoSlot("backKey", t("back"))}
          {photoSlot("selfieKey", t("selfie"))}
        </div>
        <span className="text-muted-foreground text-xs">{t("photoHint")}</span>
      </div>

      <FormError message={formError} />

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" disabled={submitting || uploading !== null}>
          {submitting ? t("submitting") : t("submit")}
        </Button>
        <Button type="button" variant="outline" size="lg" asChild>
          <Link href="/listings">{t("keepBrowsing")}</Link>
        </Button>
      </div>
    </form>
  );
};

export default VerifyForm;
