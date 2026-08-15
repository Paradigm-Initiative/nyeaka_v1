import React from "react";
import { Laptop, Smartphone, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeviceKind } from "@/types/types";

const ICONS: Record<DeviceKind, React.ElementType> = {
  phone: Smartphone,
  laptop: Laptop,
  tablet: Tablet,
};

const DeviceTile = ({
  kind,
  className,
  iconClassName,
}: {
  kind: DeviceKind;
  className?: string;
  iconClassName?: string;
}) => {
  const Icon = ICONS[kind];

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-pin-green-50",
        className,
      )}
    >
      <Icon className={cn("size-12 text-pin-green-600", iconClassName)} />
    </div>
  );
};

export default DeviceTile;
