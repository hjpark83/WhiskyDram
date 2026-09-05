import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [admin, { data: profile }] = await Promise.all([
    isAdmin(),
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <>
      <SiteHeader
        email={user.email ?? null}
        displayName={profile?.display_name ?? null}
        isAdmin={admin}
      />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:py-8">{children}</div>
    </>
  );
}
