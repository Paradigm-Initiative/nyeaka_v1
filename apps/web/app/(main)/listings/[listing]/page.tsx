// "use client";

import React from "react";

const Component = async ({
  params,
}: {
  params: Promise<{ listing: string }>;
}) => {
  const paramsData = await params;

  console.log(paramsData);

  return <div className="mx-auto container">{paramsData.listing}</div>;
};

export default Component;
