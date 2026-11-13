"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { deleteAccountAction } from "@/actions/account";
import { useErrorText } from "@/lib/use-error-text";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import FormError from "../post/form-error";

const DeleteAccount = ({ email }: { email: string }) => {
  const t = useTranslations("settings");
  const errText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await deleteAccountAction(confirm);
      if (!res.ok) return void setError(errText(res.error));
      toast.success(t("deleted"));
      router.push("/");
      router.refresh();
    });
  };

  if (!open)
    return (
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        {t("deleteButton")}
      </Button>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 bg-pin-orange-100 p-4 rounded-lg">
      <p className="text-body-sm">{t("deleteWarning")}</p>
      <Label htmlFor="confirmEmail">{t("deleteConfirmLabel", { email })}</Label>
      <Input id="confirmEmail" type="email" autoComplete="off" className="h-12 rounded-sm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <FormError message={error} />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending || !confirm.trim()}>
          {pending ? t("deleting") : t("deleteConfirm")}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
};

export default DeleteAccount;
