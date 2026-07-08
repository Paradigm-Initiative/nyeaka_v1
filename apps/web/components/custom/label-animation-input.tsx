import { useState } from "react";
import { FieldLabel } from "../ui/field";
import { FieldValues } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";
import { Button } from "../ui/button";
import { EyeIcon, EyeOffIcon } from "lucide-react";

interface Props {
  label: string;
  type: "email" | "password" | "text";
  name: string;
  isPassword?: boolean;
  isRepeatPassword?: boolean;
  field: FieldValues;
}

export default function LabelInputWithAnimation({
  label,
  type,
  name,
  isPassword = false,
  isRepeatPassword = false,
  field,
}: Props) {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const toggleVisibility = () => setIsVisible((prevState) => !prevState);
  const inputType =
    isPassword || isRepeatPassword ? (isVisible ? "text" : "password") : type;

  return (
    <div className="group relative w-full">
      <FieldLabel
        className="block top-1/2 has-[+div_input:not(:placeholder-shown)]:top-0 group-focus-within:top-0 z-10 absolute px-1 has-[+div_input:not(:placeholder-shown)]:font-medium group-focus-within:font-medium text-muted-foreground/70 has-[+div_input:not(:placeholder-shown)]:text-foreground group-focus-within:text-foreground has-[+div_input:not(:placeholder-shown)]:text-xs group-focus-within:text-xs text-sm origin-start transition-all -translate-y-1/2 cursor-text has-[+div_input:not(:placeholder-shown)]:cursor-default group-focus-within:cursor-default has-[+div_input:not(:placeholder-shown)]:pointer-events-none group-focus-within:pointer-events-none"
        htmlFor={name}
      >
        <span className="inline-flex bg-background px-2">{label}</span>
      </FieldLabel>
      {/* input field, catering also for password and the toggle functionality */}
      <div className="relative w-full">
        <Input
          id={name}
          name={name}
          placeholder=" "
          type={inputType}
          className="bg-background border-border min-w-full"
          {...field}
        />
        {(isPassword || isRepeatPassword) && (
          <Button
            aria-controls="password"
            aria-label={isVisible ? "Hide password" : "Show password"}
            aria-pressed={isVisible}
            className="focus:z-10 absolute inset-e-0 inset-y-0 flex justify-center items-center bg-transparent hover:bg-transparent disabled:opacity-50 focus-visible:border-ring rounded-e-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 w-9 h-full text-muted-foreground/80 hover:text-foreground transition-[color,box-shadow] disabled:cursor-not-allowed disabled:pointer-events-none"
            onClick={toggleVisibility}
            size="icon"
            type="button"
          >
            {isVisible ? (
              <EyeOffIcon aria-hidden="true" size={16} />
            ) : (
              <EyeIcon aria-hidden="true" size={16} />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
