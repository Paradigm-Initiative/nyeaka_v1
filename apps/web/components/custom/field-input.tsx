"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { FieldValues } from "react-hook-form";
import { cn } from "@/lib/utils";
import { FieldError } from "../ui/field";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";

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
      <Label htmlFor={name} className="field-label">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={inputType}
          placeholder={placeholder}
          className={cn("rounded-md", isPassword && "pr-11")}
          {...field}
        />
        {isPassword && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="top-0 right-0 absolute h-full text-muted-foreground hover:text-foreground"
          >
            {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </Button>
        )}
      </div>
      {errorMessage ? (
        <FieldError className="font-semibold text-xs">
          {errorMessage}
        </FieldError>
      ) : description ? (
        <span className="text-body-sm text-muted-foreground">
          {description}
        </span>
      ) : null}
    </div>
  );
}
