"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Toggle } from "../ui/toggle";

const ChipPicker = ({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) => {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-heading font-semibold text-heading-6">
        {label}
      </span>
      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => (
          <Toggle
            key={option.value}
            variant="outline"
            size="lg"
            pressed={option.value === value}
            onPressedChange={() => onChange(option.value)}
            className={cn(
              "rounded-sm border-hairline-strong data-[state=on]:bg-pin-green-600 data-[state=on]:border-pin-green-600 data-[state=on]:text-white",
            )}
          >
            {option.label}
          </Toggle>
        ))}
      </div>
    </div>
  );
};

export default ChipPicker;
