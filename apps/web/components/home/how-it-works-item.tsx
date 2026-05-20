import React from "react";

const HIWItem = ({
  id,
  title,
  description,
}: {
  id: number;
  title: string;
  description: string;
}) => {
  return (
    <li className="flex gap-4">
      <div className="flex justify-center items-center bg-primary rounded-full size-8 font-bold shrink-0">
        {id}
      </div>
      <div className="flex flex-col gap-1">
        <h4 className="font-semibold">{title}</h4>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </li>
  );
};

export default HIWItem;
