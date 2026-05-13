import React from "react";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <header>Header here</header>
      <main>{children}</main>
      <footer>Footer here</footer>
    </>
  );
};

export default MainLayout;
