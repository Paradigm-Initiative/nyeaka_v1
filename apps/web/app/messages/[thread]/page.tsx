import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import ChatThread from "@/components/messages/chat-thread";

export const metadata: Metadata = {
  title: "Messages - Nyeaka",
};

export default async function MessageThreadPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in?callbackUrl=/dashboard");

  return <ChatThread />;
}
