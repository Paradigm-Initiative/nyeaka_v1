"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createRequestSchema,
  type CreateRequestData,
  type CreateRequestInput,
} from "@/validations/post-validation";
import { createRequestAction, updateRequestAction } from "@/actions/requests";
import { CONDITION_VALUES, KIND_VALUES } from "@/lib/device-options";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Textarea } from "../ui/textarea";
import ChipPicker from "./chip-picker";
import FormError from "./form-error";

const PostRequestForm = ({
  country,
  editing,
}: {
  /** The poster's own country (set at sign-up). Only used for the city example; posts always use it. */
  country: string;
  /** When set, the form edits this request instead of creating one. */
  editing?: { id: string; values: CreateRequestInput };
}) => {
  const t = useTranslations("requestForm");
  const tDevice = useTranslations("device");
  const tForm = useTranslations("form");
  const errText = useErrorText();
  const router = useRouter();
  const [posted, setPosted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateRequestInput, unknown, CreateRequestData>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: editing?.values ?? {
      deviceType: "SMARTPHONE",
      minCondition: "GOOD",
      title: "",
      description: "",
      isUrgent: false,
      city: "",
      area: "",
      pledge: false,
    },
  });

  const tCities = useTranslations("cityExamples");
  const cityHint = tCities.has(country) ? tCities(country) : undefined;
  const noteLength = useWatch({ control, name: "description" })?.length ?? 0;

  const onSubmit = async (values: CreateRequestData) => {
    setFormError(null);
    const res = editing
      ? await updateRequestAction(editing.id, values)
      : await createRequestAction(values);
    if (res.ok && editing) {
      toast.success(t("updated"));
      router.push(`/requests/${editing.id}`);
      router.refresh();
      return;
    }
    if (res.ok) {
      setPosted(true);
      toast.success(t("live"));
      return;
    }
    setFormError(errText(res.error) ?? null);
    for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
      setError(name as keyof CreateRequestInput, { message: errText(message) });
    }
  };

  if (posted) {
    return (
      <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
        <span className="badge badge-green">{t("published")}</span>
        <h1 className="text-heading-2">{t("liveTitle")}</h1>
        <p className="text-body-lg text-muted-foreground text-pretty">
          {t("liveBody")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/listings">{t("browse")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">{t("dashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5 mx-auto py-8 max-w-2xl"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-2">{editing ? t("editTitle") : t("title")}</h1>
        <p className="text-muted-foreground text-body-md">
          {t("subtitle")}
        </p>
      </div>

      <Controller
        control={control}
        name="deviceType"
        render={({ field }) => (
          <ChipPicker
            label={t("whatDoYouNeed")}
            options={KIND_VALUES.map((v) => ({ value: v, label: tDevice(`kind.${v}`) }))}
            value={field.value ?? ""}
            onChange={field.onChange}
          />
        )}
      />

      <Controller
        control={control}
        name="minCondition"
        render={({ field }) => (
          <ChipPicker
            label={t("lowestCondition")}
            options={CONDITION_VALUES.map((v) => ({ value: v, label: tDevice(`condition.${v}`) }))}
            value={field.value ?? ""}
            onChange={field.onChange}
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title" className="field-label">{t("shortTitle")}</Label>
        <Input
          id="title"
          placeholder={t("titlePlaceholder")}
          className="h-13.5 rounded-sm"
          {...register("title")}
        />
        <FormError message={errText(errors.title?.message)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="font-heading font-semibold text-heading-6">
          {t("why")}
        </Label>
        <Textarea
          id="description"
          maxLength={280}
          placeholder={t("whyPlaceholder")}
          className="min-h-30 rounded-sm"
          {...register("description")}
        />
        <div className="flex justify-between">
          <FormError message={errText(errors.description?.message)} />
          <span className="ml-auto text-caption-bold text-pin-gray-400">{noteLength}/280</span>
        </div>
      </div>

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city" className="field-label">{tForm("city")}</Label>
          <Input id="city" placeholder={cityHint ? tForm("cityExample", { city: cityHint }) : tForm("cityPlaceholder")} className="h-13.5 rounded-sm" {...register("city")} />
          <FormError message={errText(errors.city?.message)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area" className="field-label">{tForm("area")}</Label>
          <Input id="area" placeholder={tForm("areaPlaceholder")} className="h-13.5 rounded-sm" {...register("area")} />
          <FormError message={errText(errors.area?.message)} />
        </div>
      </div>

      {!editing && (
      <div className="flex flex-col gap-1.5">
        <Controller
          control={control}
          name="pledge"
          render={({ field }) => (
            <Label
              htmlFor="pledge"
              className="items-start gap-2.5 font-normal text-muted-foreground text-body-sm leading-normal"
            >
              <Checkbox
                id="pledge"
                checked={!!field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                onBlur={field.onBlur}
                aria-invalid={!!errors.pledge}
                className="mt-0.5"
              />
              <span>
                {t("pledge")}
              </span>
            </Label>
          )}
        />
        <FormError message={errText(errors.pledge?.message)} />
      </div>

      )}

      <FormError message={formError ?? undefined} />

      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? (editing ? t("saving") : t("posting")) : editing ? t("save") : t("post")}
      </Button>
    </form>
  );
};

export default PostRequestForm;
