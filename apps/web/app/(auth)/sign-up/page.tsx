import { getLocale } from "next-intl/server";
import { SignupForm } from "@/app/(auth)/sign-up/signup-form";
import { getCountries } from "@/lib/countries";
import { getEnabledCountryCodes } from "@/lib/enabled-countries";

export default async function Page() {
  const countries = getCountries(await getLocale(), { only: await getEnabledCountryCodes() });
  return (
    <div className="flex-col flex-1 flex-center py-14 h-full">
      <div className="w-full max-w-115">
        <SignupForm countries={countries} />
      </div>
    </div>
  );
}
