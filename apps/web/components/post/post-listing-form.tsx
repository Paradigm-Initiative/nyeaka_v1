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
import { CONDITION_OPTIONS, KIND_OPTIONS } from "@/lib/device-options";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Toggle } from "../ui/toggle";
import ChipPicker from "./chip-picker";
import PhotoUploader from "./photo-uploader";
import CountrySelect, { type CountryOption } from "./country-select";
import FormError from "./form-error";

const EXTRAS = [
  { label: "Charger", field: "hasCharger" },
  { label: "Keyboard", field: "hasKeyboard" },
] as const;

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
      toast.success("Listing updated");
      router.push(`/listings/${editing.id}`);
      router.refresh();
      return;
    }
    if (res.ok) {
      setCreatedId(res.data.id);
      toast.success("Your listing is live");
      return;
    }
    setFormError(res.error);
    for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
      setError(name as keyof CreateListingInput, { message });
    }
  };

  if (createdId) {
    return (
      <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
        <span className="badge badge-green">Published</span>
        <h1 className="text-heading-2">Your listing is live</h1>
        <p className="text-body-lg text-muted-foreground text-pretty">
          Requests will arrive with a short note explaining the need. Read
          them, pick the one you want, and the chat opens. You are never
          obliged to give it to anyone.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/listings/${createdId}`}>View my listing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">See my dashboard</Link>
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
        <h1 className="text-heading-2">{editing ? "Edit your listing" : "List a device"}</h1>
        <p className="text-muted-foreground text-body-md">
          Be honest about the condition — a phone described accurately is
          claimed faster than one oversold.
        </p>
      </div>

      <Controller
        control={control}
        name="deviceType"
        render={({ field }) => (
          <ChipPicker
            label="What is it?"
            options={KIND_OPTIONS.map((o) => o.label)}
            value={KIND_OPTIONS.find((o) => o.value === field.value)?.label ?? ""}
            onChange={(label) =>
              field.onChange(KIND_OPTIONS.find((o) => o.label === label)?.value)
            }
            capitalize
          />
        )}
      />

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand" className="field-label">Brand</Label>
          <Input id="brand" placeholder="e.g. Tecno" className="h-13.5 rounded-sm" {...register("brand")} />
          <FormError message={errors.brand?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="model" className="field-label">Model</Label>
          <Input id="model" placeholder="e.g. Spark 8" className="h-13.5 rounded-sm" {...register("model")} />
          <FormError message={errors.model?.message} />
        </div>
      </div>

      <Controller
        control={control}
        name="condition"
        render={({ field }) => (
          <ChipPicker
            label="Condition"
            options={CONDITION_OPTIONS.map((o) => o.label)}
            value={CONDITION_OPTIONS.find((o) => o.value === field.value)?.label ?? ""}
            onChange={(label) =>
              field.onChange(CONDITION_OPTIONS.find((o) => o.label === label)?.value)
            }
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="field-label">
          Anything else? (optional)
        </Label>
        <Textarea
          id="description"
          maxLength={1000}
          placeholder="Age, battery life, any scratches or faults."
          className="min-h-24 rounded-sm"
          {...register("description")}
        />
        <FormError message={errors.description?.message} />
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
      <FormError message={errors.photos?.message ?? (errors.photos as { root?: { message?: string } } | undefined)?.root?.message} />

      <div className="flex flex-col gap-2.5">
        <span className="font-heading font-semibold text-heading-6">Comes with</span>
        <div className="flex flex-wrap gap-2.5">
          {EXTRAS.map(({ label, field }) => (
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
                  {label}
                </Toggle>
              )}
            />
          ))}
        </div>
      </div>

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="countryCode" className="field-label">Country</Label>
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
          <FormError message={errors.countryCode?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city" className="field-label">City</Label>
          <Input id="city" placeholder="Lagos" className="h-13.5 rounded-sm" {...register("city")} />
          <FormError message={errors.city?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="area" className="field-label">Area (optional)</Label>
          <Input id="area" placeholder="Yaba" className="h-13.5 rounded-sm" {...register("area")} />
          <FormError message={errors.area?.message} />
        </div>
      </div>

      <div className="bg-pin-orange-100 p-4 rounded-lg text-body-sm">
        Only your area shows publicly — never your street or house number.
        You choose the meeting place later, in the chat.
      </div>

      <FormError message={formError ?? undefined} />

      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting || uploadingPhotos}>
        {isSubmitting ? (editing ? "Saving…" : "Publishing…") : uploadingPhotos ? "Uploading photos…" : editing ? "Save changes" : "Publish listing"}
      </Button>
    </form>
  );
};

export default PostListingForm;
