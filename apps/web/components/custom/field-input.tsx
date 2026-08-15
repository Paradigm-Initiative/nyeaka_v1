"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { FieldError } from "../ui/field";
import { Input } from "../ui/input";

interface Props {
  label: string;
  type: "email" | "password" | "text" | "tel";
  name: string;
  placeholder?: string;
  isPassword?: boolean;
  field: FieldValues;
  description?: string;
  errorMessage?: string;
}

export default function FieldInput({
  label,
  type,
  name,
  placeholder,
  isPassword = false,
  field,
  description,
  errorMessage,
}: Props) {
  const [visible, setVisible] = useState(false);
  const inputType = isPassword ? (visible ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={inputType}
          placeholder={placeholder}
          className={cn("h-13.5 rounded-sm", isPassword && "pr-11")}
          {...field}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="top-0 right-0 absolute flex items-center px-3.5 h-full text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        )}
      </div>
      {errorMessage ? (
        <FieldError className="font-semibold text-xs">
          {errorMessage}
        </FieldError>
      ) : description ? (
        <span className="text-muted-foreground text-body-sm">
          {description}
        </span>
      ) : null}
    </div>
  );
}
