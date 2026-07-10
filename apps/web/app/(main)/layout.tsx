import Footer from "@/components/layout/footer";
import Header from "@/components/layout/header";
import React from "react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
const MainLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = auth.api.getSession({ headers: await headers() });

  return (
    <div className="flex flex-col w-full min-h-screen">
      <Header />
      {/* <Header initialSession={session} /> */}
      <main className="flex flex-col flex-1">{children}</main>
      <Footer />
    </div>
  );
};

export default MainLayout;
