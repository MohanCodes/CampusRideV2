import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { getUser } from "@/lib/auth/dal";
import { isDemo } from "@/lib/demo";

// Safety, Terms and Privacy open for everyone. Signed-in people get the usual frame; visitors get it without the app navigation.
export async function StaticPage({ title, children }: { title: string; children: ReactNode }) {
  const signedIn = Boolean(await getUser());
  const demo = isDemo();
  return (
    <AppShell signedIn={signedIn} demo={demo} hideBottomNav={!signedIn && !demo}>
      <article className="mt-6 max-w-[68ch]">
        <h1 className="t-h1 mb-6 text-[2.4rem] md:text-[3rem]">{title}</h1>
        {children}
      </article>
    </AppShell>
  );
}
