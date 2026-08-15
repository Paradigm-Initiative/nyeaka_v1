import React from "react";

const HIWItem = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => {
  return (
    <div className="flex flex-col gap-2.5 pt-3 border-t-2 border-pin-green-600">
      <span className="text-pin-green-600 text-micro-uppercase">
        {eyebrow}
      </span>
      <h3 className="text-heading-4">{title}</h3>
      <p className="text-muted-foreground text-body-md">{description}</p>
    </div>
  );
};

export default HIWItem;
