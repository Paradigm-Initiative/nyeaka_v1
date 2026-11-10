"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export type CountryOption = { code: string; name: string };

// Options are built on the server and passed in: Intl.DisplayNames output differs
// between Node and browsers, which would cause a hydration mismatch.
const CountrySelect = ({
  id,
  countries,
  value,
  onChange,
  invalid,
}: {
  id?: string;
  countries: CountryOption[];
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
}) => (
  <Select value={value || undefined} onValueChange={onChange}>
    <SelectTrigger id={id} size="lg" className="rounded-sm" aria-invalid={invalid}>
      <SelectValue placeholder="Select country" />
    </SelectTrigger>
    <SelectContent className="max-h-72">
      {countries.map((c) => (
        <SelectItem key={c.code} value={c.code}>
          {c.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

export default CountrySelect;
