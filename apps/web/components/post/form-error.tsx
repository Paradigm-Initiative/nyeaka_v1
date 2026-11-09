import React from "react";

const FormError = ({ message }: { message?: string }) =>
  message ? (
    <span role="alert" className="font-semibold text-destructive text-xs">
      {message}
    </span>
  ) : null;

export default FormError;
