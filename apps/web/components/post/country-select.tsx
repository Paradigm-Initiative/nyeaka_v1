"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type CountryOption = { code: string; name: string };

// Options are built on the server and passed in: Intl.DisplayNames output differs
// between Node and browsers, which would cause a hydration mismatch.
const CountrySelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select"> & { countries: CountryOption[] }
>(({ className, countries, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "bg-transparent px-3 border border-input rounded-sm w-full h-13.5 text-base",
      className,
    )}
    {...props}
  >
    <option value="">Select country</option>
    {countries.map((c) => (
      <option key={c.code} value={c.code}>
        {c.name}
      </option>
    ))}
  </select>
));
CountrySelect.displayName = "CountrySelect";

export default CountrySelect;
