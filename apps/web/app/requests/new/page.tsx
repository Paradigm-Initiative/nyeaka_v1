import type { Metadata } from "next";
import { getServerSession } from "@/lib/get-session";
import { getUserProfile } from "@/lib/queries";
import { COUNTRIES } from "@/lib/countries";
import PostRequestForm from "@/components/post/post-request-form";
import SignInRequired from "@/components/auth/sign-in-required";

export const metadata: Metadata = {
  title: "Ask for a device - Nyeaka",
};

export default async function NewRequestPage() {
  const session = await getServerSession();

  if (!session) {
    return (
      <SignInRequired
        title="Sign in to ask for a device"
        description="Donors choose who receives their device. Knowing every requester is a real, verified person is what makes that choice safe."
        callbackUrl="/requests/new"
      />
    );
  }

  const profile = await getUserProfile(session.user.id);

  return (
    <div className="section-wrapper">
      <PostRequestForm defaultCountry={profile?.countryCode ?? ""} countries={COUNTRIES} />
    </div>
  );
}
