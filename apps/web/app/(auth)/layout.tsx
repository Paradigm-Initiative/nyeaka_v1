import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (session) redirect("/dashboard");

  return children;
}
