import { SiteHeader } from "@/components/site-header";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 로그인 없이도 볼 수 있는 화면들.
 *
 * `(app)` 레이아웃은 로그인을 강제해요. 위스키 이야기는 링크를 받은 사람이
 * 바로 읽을 수 있어야 블로그 구실을 해서, 여기만 따로 뒀어요. 읽기만 열려
 * 있고 **쓰기·댓글은 여전히 로그인이 필요해요** (각 화면과 서버 액션에서 막아요).
 *
 * 로그인한 사람에게는 `(app)` 과 똑같은 머리글을 보여줘서, 화면을 오가도
 * 로그아웃된 것처럼 보이지 않게 해요.
 */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인 안 한 사람에게는 DB 를 더 두드리지 않아요
  const [admin, profile] = user
    ? await Promise.all([
        isAdmin(),
        supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle()
          .then((r) => r.data),
      ])
    : [false, null];

  return (
    <>
      <SiteHeader
        email={user?.email ?? null}
        displayName={profile?.display_name ?? null}
        isAdmin={admin}
        signedIn={Boolean(user)}
      />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 sm:py-8">{children}</div>
    </>
  );
}
