"use client";

import React from "react";
import { cn } from "@/lib/utils";

const ChipPicker = ({
  label,
  options,
  value,
  onChange,
  capitalize,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  capitalize?: boolean;
}) => {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-heading font-semibold text-heading-6">
        {label}
      </span>
      <div className="flex flex-wrap gap-2.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "min-h-11 rounded-sm border px-5 py-3 font-heading text-sm font-semibold",
              capitalize && "capitalize",
              option === value
                ? "bg-pin-green-600 text-white border-pin-green-600"
                : "border-hairline-strong text-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChipPicker;
