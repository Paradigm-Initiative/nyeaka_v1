import React from "react";
import Link from "next/link";
import Image from "next/image";
import DeviceTile from "../device-tile";
import type { DeviceType } from "@/generated/prisma/enums";

const DetailLayout = ({
  kind,
  photos = [],
  eyebrow,
  title,
  place,
  posted,
  note,
  specs,
  who,
  rating,
  handoffs,
  backHref,
  backLabel,
  children,
}: {
  kind: DeviceType;
  photos?: string[];
  eyebrow: string;
  title: string;
  place: string;
  posted: string;
  note: string;
  specs: { label: string; value: string }[];
  who: string;
  rating: number | null;
  handoffs: number;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) => {
  return (
    <div className="section-wrapper">
      <div className="flex flex-col gap-6">
        <Link
          href={backHref}
          className="inline-flex items-center self-start min-h-11 font-semibold text-body-sm text-link hover:underline"
        >
          {backLabel}
        </Link>

        <div className="items-start gap-6 lg:gap-8 grid grid-cols-1 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            {photos.length > 0 ? (
              <>
                <div className="relative rounded-lg h-56 sm:h-72 lg:h-80 overflow-hidden">
                  <Image src={photos[0]} alt={title} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                </div>
                {photos.length > 1 && (
                  <div className="gap-3 grid grid-cols-3">
                    {photos.slice(1).map((url) => (
                      <div key={url} className="relative rounded-lg h-16 sm:h-22 overflow-hidden">
                        <Image src={url} alt="" fill sizes="200px" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <DeviceTile kind={kind} className="h-56 sm:h-72 lg:h-80" iconClassName="size-24" />
                <div className="gap-3 grid grid-cols-3">
                  <DeviceTile kind={kind} className="h-16 sm:h-22" />
                  <DeviceTile kind={kind} className="h-16 sm:h-22" />
                  <DeviceTile kind={kind} className="h-16 sm:h-22" />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-pin-green-600 text-micro-uppercase">
                {eyebrow}
              </span>
              <h1 className="text-heading-1 text-pretty">{title}</h1>
              <span className="text-muted-foreground text-subtitle">
                {place} · posted {posted}
              </span>
            </div>

            <p className="text-body-lg text-pretty">{note}</p>

            <div className="gap-3 grid grid-cols-1 sm:grid-cols-3 py-3 border-y">
              {specs.map((spec) => (
                <div key={spec.label} className="flex flex-col gap-0.5">
                  <span className="text-micro-uppercase text-pin-gray-400">
                    {spec.label}
                  </span>
                  <span className="text-body-md capitalize">
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <span className="flex justify-center items-center bg-pin-green-50 rounded-full size-12 font-heading font-bold text-pin-green-600 text-lg">
                  {who[0]?.toUpperCase()}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-heading font-semibold text-heading-5">
                    {who}
                  </span>
                  <span className="text-muted-foreground text-body-sm">
                    {rating !== null ? `${rating.toFixed(1)} ★` : "No ratings yet"} · {handoffs} completed handoff{handoffs === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <p className="text-muted-foreground text-body-sm">
                First name and general area only until you both agree to
                share more. Exact address is never published.
              </p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailLayout;
