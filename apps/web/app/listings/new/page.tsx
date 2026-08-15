import type { Metadata } from "next";
import { getServerSession } from "@/lib/get-session";
import PostListingForm from "@/components/post/post-listing-form";
import SignInRequired from "@/components/auth/sign-in-required";

export const metadata: Metadata = {
  title: "List a device - Nyeaka",
};

export default async function NewListingPage() {
  const session = await getServerSession();

  if (!session) {
    return (
      <SignInRequired
        title="Sign in to list a device"
        description="Donors verify their identity so the person collecting the device knows who they're meeting."
        callbackUrl="/listings/new"
      />
    );
  }

  return (
    <div className="section-wrapper">
      <PostListingForm />
    </div>
  );
}
