import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { LegalLinks } from "@/components/LegalLinks";
import { Logo } from "@/components/Logo";
import { getUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/routes";

export const metadata = { title: "Sign in — CampusRide" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const raw = params.next;
  const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
  if (await getUser()) redirect(next);

  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-[480px] flex-col px-4 py-6 sm:px-[25px]">
      <header className="flex h-[78px] items-center">
        <Logo />
      </header>
      <div className="card mt-6 p-6 md:p-8">
        <SignInForm next={next} />
      </div>
      <p className="mt-6 text-sm text-muted">
        Only students with a Claremont Colleges email can sign in. CampusRide never asks for a password.
      </p>
      <LegalLinks className="mt-2" />
    </main>
  );
}
