"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createListingSchema,
  type CreateListingData,
  type CreateListingInput,
} from "@/validations/post-validation";
import { createListingAction } from "@/actions/listings";
import { CONDITION_OPTIONS, KIND_OPTIONS } from "@/lib/device-options";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ChipPicker from "./chip-picker";
import CountrySelect, { type CountryOption } from "./country-select";
import FormError from "./form-error";

const EXTRAS = [
  { label: "Charger", field: "hasCharger" },
  { label: "Keyboard", field: "hasKeyboard" },
] as const;

const PostListingForm = ({
  defaultCountry = "",
  countries,
}: {
  defaultCountry?: string;
  countries: CountryOption[];
}) => {
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateListingInput, unknown, CreateListingData>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
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
    const res = await createListingAction(values);
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
        <h1 className="text-heading-2">List a device</h1>
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
          <label htmlFor="brand" className="field-label">Brand</label>
          <Input id="brand" placeholder="e.g. Tecno" className="h-13.5 rounded-sm" {...register("brand")} />
          <FormError message={errors.brand?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="model" className="field-label">Model</label>
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
        <label htmlFor="description" className="field-label">
          Anything else? (optional)
        </label>
        <textarea
          id="description"
          maxLength={1000}
          placeholder="Age, battery life, any scratches or faults."
          className="bg-transparent px-3 py-2 border border-input rounded-sm min-h-24"
          {...register("description")}
        />
        <FormError message={errors.description?.message} />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="font-heading font-semibold text-heading-6">Photos</span>
        <div className="gap-3 grid grid-cols-2 sm:grid-cols-3">
          {["Add photo", "Screen on", "Any damage"].map((t) => (
            <div
              key={t}
              className="flex justify-center items-center border border-hairline-strong border-dashed rounded-sm h-28 text-muted-foreground text-body-sm"
            >
              {t}
            </div>
          ))}
        </div>
        <span className="text-muted-foreground text-body-sm">
          Photo upload is coming next. Three photos is plenty, damage included.
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="font-heading font-semibold text-heading-6">Comes with</span>
        <div className="flex flex-wrap gap-2.5">
          {EXTRAS.map(({ label, field }) => (
            <Controller
              key={field}
              control={control}
              name={field}
              render={({ field: f }) => (
                <button
                  type="button"
                  aria-pressed={!!f.value}
                  onClick={() => f.onChange(!f.value)}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-sm border px-4.5 py-3 font-heading text-sm font-semibold",
                    f.value ? "bg-surface-feature border-pin-green-600" : "border-hairline-strong",
                  )}
                >
                  <span className="w-3 text-pin-green-600">{f.value ? "✓" : ""}</span>
                  {label}
                </button>
              )}
            />
          ))}
        </div>
      </div>

      <div className="gap-3 grid grid-cols-1 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="countryCode" className="field-label">Country</label>
          <CountrySelect id="countryCode" countries={countries} {...register("countryCode")} />
          <FormError message={errors.countryCode?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="city" className="field-label">City</label>
          <Input id="city" placeholder="Lagos" className="h-13.5 rounded-sm" {...register("city")} />
          <FormError message={errors.city?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="area" className="field-label">Area (optional)</label>
          <Input id="area" placeholder="Yaba" className="h-13.5 rounded-sm" {...register("area")} />
          <FormError message={errors.area?.message} />
        </div>
      </div>

      <div className="bg-pin-orange-100 p-4 rounded-lg text-body-sm">
        Only your area shows publicly — never your street or house number.
        You choose the meeting place later, in the chat.
      </div>

      <FormError message={formError ?? undefined} />

      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? "Publishing…" : "Publish listing"}
      </Button>
    </form>
  );
};

export default PostListingForm;
