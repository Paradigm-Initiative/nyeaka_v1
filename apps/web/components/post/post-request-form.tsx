"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  createRequestSchema,
  type CreateRequestData,
  type CreateRequestInput,
} from "@/validations/post-validation";
import { createRequestAction } from "@/actions/requests";
import { CONDITION_OPTIONS, KIND_OPTIONS } from "@/lib/device-options";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import ChipPicker from "./chip-picker";
import CountrySelect, { type CountryOption } from "./country-select";
import FormError from "./form-error";

const PostRequestForm = ({
  defaultCountry = "",
  countries,
}: {
  defaultCountry?: string;
  countries: CountryOption[];
}) => {
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
    defaultValues: {
      deviceType: "SMARTPHONE",
      minCondition: "GOOD",
      title: "",
      description: "",
      isUrgent: false,
      city: "",
      area: "",
      countryCode: defaultCountry,
      pledge: false,
    },
  });

  const noteLength = useWatch({ control, name: "description" })?.length ?? 0;

  const onSubmit = async (values: CreateRequestData) => {
    setFormError(null);
    const res = await createRequestAction(values);
    if (res.ok) {
      setPosted(true);
      toast.success("Your request is live");
      return;
    }
    setFormError(res.error);
    for (const [name, message] of Object.entries(res.fieldErrors ?? {})) {
      setError(name as keyof CreateRequestInput, { message });
    }
  };

  if (posted) {
    return (
      <div className="flex flex-col items-start gap-4 mx-auto py-12 max-w-lg">
        <span className="badge badge-green">Published</span>
        <h1 className="text-heading-2">Your request is live</h1>
        <p className="text-body-lg text-muted-foreground text-pretty">
          Donors in your area can see it now, and you&apos;ll hear from us if
          one offers you a device. Keep browsing listings in the meantime —
          asking directly often works faster.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/listings">Browse devices</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">My dashboard</Link>
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
        <h1 className="text-heading-2">Ask for a device</h1>
        <p className="text-muted-foreground text-body-md">
          Donors read requests before they choose. Plain and specific works
          better than urgent.
        </p>
      </div>

      <Controller
        control={control}
        name="deviceType"
        render={({ field }) => (
          <ChipPicker
            label="What do you need?"
            options={KIND_OPTIONS.map((o) => o.label)}
            value={KIND_OPTIONS.find((o) => o.value === field.value)?.label ?? ""}
            onChange={(label) =>
              field.onChange(KIND_OPTIONS.find((o) => o.label === label)?.value)
            }
            capitalize
          />
        )}
      />

      <Controller
        control={control}
        name="minCondition"
        render={({ field }) => (
          <ChipPicker
            label="Lowest condition you can work with"
            options={CONDITION_OPTIONS.map((o) => o.label)}
            value={CONDITION_OPTIONS.find((o) => o.value === field.value)?.label ?? ""}
            onChange={(label) =>
              field.onChange(CONDITION_OPTIONS.find((o) => o.label === label)?.value)
            }
          />
        )}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="field-label">Short title</label>
        <Input
          id="title"
          placeholder="e.g. Laptop for my final-year project"
          className="h-13.5 rounded-sm"
          {...register("title")}
        />
        <FormError message={errors.title?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="font-heading font-semibold text-heading-6">
          Why do you need it?
        </label>
        <Textarea
          id="description"
          maxLength={280}
          placeholder="What it's for — school, work, your business — and what you're managing without it now."
          className="min-h-30 rounded-sm"
          {...register("description")}
        />
        <div className="flex justify-between">
          <FormError message={errors.description?.message} />
          <span className="ml-auto text-caption-bold text-pin-gray-400">{noteLength}/280</span>
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
          <Input id="city" placeholder="Enugu" className="h-13.5 rounded-sm" {...register("city")} />
          <FormError message={errors.city?.message} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="area" className="field-label">Area (optional)</label>
          <Input id="area" placeholder="Nsukka" className="h-13.5 rounded-sm" {...register("area")} />
          <FormError message={errors.area?.message} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-muted-foreground text-body-sm">
          <input
            type="checkbox"
            className="accent-pin-green-600 mt-0.5 size-4.5"
            {...register("pledge")}
          />
          <span>
            I am asking for my own use and will not resell it. This pledge
            appears on my request, and breaking it removes my account.
          </span>
        </label>
        <FormError message={errors.pledge?.message} />
      </div>

      <FormError message={formError ?? undefined} />

      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? "Posting…" : "Post request"}
      </Button>
    </form>
  );
};

export default PostRequestForm;
