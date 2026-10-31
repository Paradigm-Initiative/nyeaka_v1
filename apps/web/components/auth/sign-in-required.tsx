import React from "react";
import Link from "next/link";
import { Button } from "../ui/button";

const SignInRequired = ({
  title,
  description,
  callbackUrl,
}: {
  title: string;
  description: string;
  callbackUrl: string;
}) => {
  return (
    <div className="flex flex-col items-start gap-4 mx-auto py-16 max-w-lg section-wrapper">
      <h1 className="text-heading-2">{title}</h1>
      <p className="text-muted-foreground text-body-lg">{description}</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
            Sign in
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Create an account</Link>
        </Button>
      </div>
    </div>
  );
};

export default SignInRequired;
