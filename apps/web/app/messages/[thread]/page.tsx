import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/get-session";
import { getThread, markThreadRead } from "@/lib/messages";
import { ServiceError } from "@/lib/errors";
import ChatThread from "@/components/messages/chat-thread";

export const metadata: Metadata = {
  title: "Messages - Nyeaka",
};

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ thread: string }>;
}) {
  const { thread: id } = await params;
  const session = await getServerSession();
  if (!session) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/messages/${id}`)}`);

  let thread;
  try {
    thread = await getThread(session.user.id, id);
  } catch (e) {
    // Missing and not-yours look identical, so ids don't reveal which conversations exist.
    if (e instanceof ServiceError) notFound();
    throw e;
  }
  await markThreadRead(session.user.id, id);

  return <ChatThread thread={thread} />;
}
