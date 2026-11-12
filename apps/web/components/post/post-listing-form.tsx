"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createListingSchema,
  type CreateListingData,
  type CreateListingInput,
} from "@/validations/post-validation";
import { createListingAction, updateListingAction } from "@/actions/listings";
import { CONDITION_VALUES, KIND_VALUES } from "@/lib/device-options";
import { useTranslations } from "next-intl";
import { useErrorText } from "@/lib/use-error-text";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Toggle } from "../ui/toggle";
import ChipPicker from "./chip-picker";
import PhotoUploader from "./photo-uploader";
import CountrySelect, { type CountryOption } from "./country-select";
import FormError from "./form-error";

const EXTRAS = ["hasCharger", "hasKeyboard"] as const;

const PostListingForm = ({
  defaultCountry = "",
  countries,
  editing,
}: {
  defaultCountry?: string;
  countries: CountryOption[];
  /** When set, the form edits this listing instead of creating one. */
  editing?: { id: string; values: CreateListingInput };
}) => {
  const t = useTranslations("listingForm");
  const tDevice = useTranslations("device");
  const tForm = useTranslations("form");
  const errText = useErrorText();
  const router = useRouter();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateListingInput, unknown, CreateListingData>({
    resolver: zodResolver(createListingSchema),
    defaultValues: editing?.values ?? {
      deviceType: "SMARTPHONE",
      brand: "",
      model: "",
      condition: "GOOD",
      city: "",
      area: "",
      countryCode: defaultCountry,
      photos: [],
      hasCharger: true,
      hasKeyboard: false,
    },
  });

  const onSubmit = async (values: CreateListingData) => {
    setFormError(null);
    const res = editing
      ? await updateListingAction(editing.id, values)
      : await createListingAction(values);
    if (res.ok && editing) {
      toast.success(t("updated"));
      router.push(`/listings/${editing.id}`);
      router.refresh();
      return;
    }
    if (res.ok) {
      setCreatedId(res.data.id);
      toast.success(t("live"));
      return;
    }
    setFormError(errText(res.error) ?? null);
    for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
      setError(name as keyof CreateListingInput, { message: errText(message) });
    }
  };

  if (createdId) {
    return (
      <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
        <span className="badge badge-green">{t("published")}</span>
        <h1 className="text-heading-2">{t("liveTitle")}</h1>
        <p className="text-body-lg text-muted-foreground text-pretty">
          {t("liveBody")}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/listings/${createdId}`}>{t("view")}</Link>
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
            label={t("whatIsIt")}
            options={KIND_VALUES.map((v) => ({ value: v, label: tDevice(`kind.${v}`) }))}
            value={field.value ?? ""}
            onChange={field.onChange}
          />
        )}
      />

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand" className="field-label">{t("brand")}</Label>
          <Input id="brand" placeholder={t("brandPlaceholder")} className="h-13.5 rounded-sm" {...register("brand")} />
          <FormError message={errText(errors.brand?.message)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="model" className="field-label">{t("model")}</Label>
          <Input id="model" placeholder={t("modelPlaceholder")} className="h-13.5 rounded-sm" {...register("model")} />
          <FormError message={errText(errors.model?.message)} />
        </div>
      </div>

      <Controller
        control={control}
        name="condition"
        render={({ field }) => (
          <ChipPicker
            label={t("condition")}
            options={CONDITION_VALUES.map((v) => ({ value: v, label: tDevice(`condition.${v}`) }))}
            value={field.value ?? ""}
            onChange={field.onChange}
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="field-label">
          {t("anythingElse")}
        </Label>
        <Textarea
          id="description"
          maxLength={1000}
          placeholder={t("descriptionPlaceholder")}
          className="min-h-24 rounded-sm"
          {...register("description")}
        />
        <FormError message={errText(errors.description?.message)} />
      </div>

      <Controller
        control={control}
        name="photos"
        render={({ field }) => (
          <PhotoUploader
            value={field.value ?? []}
            onChange={field.onChange}
            onBusyChange={setUploadingPhotos}
          />
        )}
      />
      <FormError message={errText(errors.photos?.message ?? (errors.photos as { root?: { message?: string } } | undefined)?.root?.message)} />

      <div className="flex flex-col gap-2.5">
        <span className="font-heading font-semibold text-heading-6">{t("comesWith")}</span>
        <div className="flex flex-wrap gap-2.5">
          {EXTRAS.map((field) => (
            <Controller
              key={field}
              control={control}
              name={field}
              render={({ field: f }) => (
                <Toggle
                  variant="outline"
                  size="lg"
                  pressed={!!f.value}
                  onPressedChange={f.onChange}
                  className="rounded-sm data-[state=on]:bg-surface-feature data-[state=on]:border-pin-green-600"
                >
                  <span className="w-3 text-pin-green-600">{f.value ? "✓" : ""}</span>
                  {t(`extras.${field}`)}
                </Toggle>
              )}
            />
          ))}
        </div>
      </div>

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="countryCode" className="field-label">{tForm("country")}</Label>
          <Controller
            control={control}
            name="countryCode"
            render={({ field }) => (
              <CountrySelect
                id="countryCode"
                countries={countries}
                value={field.value}
                onChange={field.onChange}
                invalid={!!errors.countryCode}
              />
            )}
          />
          <FormError message={errText(errors.countryCode?.message)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city" className="field-label">{tForm("city")}</Label>
          <Input id="city" placeholder={tForm("cityPlaceholder")} className="h-13.5 rounded-sm" {...register("city")} />
          <FormError message={errText(errors.city?.message)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area" className="field-label">{tForm("area")}</Label>
          <Input id="area" placeholder={tForm("areaPlaceholder")} className="h-13.5 rounded-sm" {...register("area")} />
          <FormError message={errText(errors.area?.message)} />
        </div>
      </div>

      <div className="bg-pin-orange-100 p-4 rounded-lg text-body-sm">
        {tForm("privacy")}
      </div>

      <FormError message={formError ?? undefined} />

      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting || uploadingPhotos}>
        {isSubmitting ? (editing ? t("saving") : t("publishing")) : uploadingPhotos ? t("uploading") : editing ? t("save") : t("publish")}
      </Button>
    </form>
  );
};

export default PostListingForm;
