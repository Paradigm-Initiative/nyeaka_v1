import React from "react";
import { Laptop, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceType } from "@/generated/prisma/enums";

const ICONS: Record<DeviceType, React.ElementType> = {
  SMARTPHONE: Smartphone,
  LAPTOP: Laptop,
  TABLET: Tablet,
  DESKTOP: Laptop,
  OTHER: Laptop,
};

const DeviceTile = ({
  kind,
  className,
  iconClassName,
}: {
  kind: DeviceType;
  className?: string;
  iconClassName?: string;
}) => {
  const Icon = ICONS[kind];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-pin-gray-50",
        className,
      )}
    >
      <Icon className={cn("size-12 text-pin-orange-600", iconClassName)} />
    </div>
  );
};

export default DeviceTile;
