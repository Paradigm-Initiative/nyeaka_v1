import { useState } from "react";
import { FieldDescription, FieldError, FieldLabel } from "../ui/field";
import { FieldValues } from "react-hook-form";

import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from "../ui/input-group";

import { EyeIcon, EyeOffIcon } from "lucide-react";

interface Props {
  label: string;
  type: "email" | "password" | "text";
  name: string;
  isPassword?: boolean;
  isRepeatPassword?: boolean;
  field: FieldValues;
  description?: string;
  errorMessage?: string;
}

export default function LabelInputWithAnimation({
  label,
  type,
  name,
  isPassword = false,
  isRepeatPassword = false,
  description,
  errorMessage,
  field,
}: Props) {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const toggleVisibility = () => setIsVisible((prevState) => !prevState);
  const inputType =
    isPassword || isRepeatPassword ? (isVisible ? "text" : "password") : type;

  const renderErrorDescription = () => {
    if (errorMessage) {
      return (
        <FieldError className="font-semibold text-xs">
          {errorMessage}
        </FieldError>
      );
    }
    if (description && !errorMessage) {
      return <FieldDescription>{description}</FieldDescription>;
    }
  };

  return (
    <div className="flex flex-col w-full">
      <div className="group relative flex flex-col w-full">
        <FieldLabel className="z-10 mini-label" htmlFor={name}>
          <span className="inline-flex bg-background px-2">{label}</span>
        </FieldLabel>
        {/* input field, catering also for password and the toggle functionality */}
        <InputGroup className="bg-background border-border">
          <InputGroupInput
            id={name}
            name={name}
            type={inputType}
            placeholder=" "
            {...field}
          />

          {(isPassword || isRepeatPassword) && (
            <InputGroupButton
              aria-controls="password"
              aria-label={isVisible ? "Hide password" : "Show password"}
              aria-pressed={isVisible}
              className="text-muted-foreground/80 hover:text-foreground transition-[color,box-shadow] disabled:cursor-not-allowed disabled:pointer-events-none"
              onClick={toggleVisibility}
              type="button"
            >
              {isVisible ? (
                <EyeOffIcon aria-hidden="true" size={16} />
              ) : (
                <EyeIcon aria-hidden="true" size={16} />
              )}
            </InputGroupButton>
          )}
        </InputGroup>
      </div>

      {renderErrorDescription()}
    </div>
  );
}
