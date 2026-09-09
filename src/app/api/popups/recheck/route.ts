import { NextResponse, type NextRequest } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { recheckPopup } from "@/lib/ai/popup-research";
import { diffRecheck, needsRecheck, snapshot } from "@/lib/popup/recheck";
import { listPopups } from "@/lib/popup/store";
import { activeProvider } from "@/lib/ai/provider";

/**
 * 저장해둔 팝업을 **주기적으로** 다시 확인해요 (Vercel Cron 이 불러요).
 *
 * ## 왜 크론이 필요한가
 *
 * 팝업은 기간이 흔하게 바뀌어요 (연장·조기 종료·시간 변경). 한 번 정리해두고
 * 그대로 두면, 우리 이름으로 틀린 기간을 보여주게 돼요. 링크만 걸어두던
 * 때보다 나빠지는 거죠. 그래서 확인을 사람 기억에 맡기지 않아요.
 *
 * ## 값을 바로 안 고쳐요
 *
 * 찾아낸 차이는 `pending_recheck` 에 **제안**으로 쌓이고, 관리자가
 * `/admin/popups` 에서 보고 적용해요. AI 가 공개된 정보를 말없이 바꾸지
 * 않는다는 원칙을 크론도 지켜요.
 *
 * ## 필요한 환경변수
 *
 *  - `CRON_SECRET` — Vercel Cron 이 `Authorization: Bearer` 로 자동으로 보내요.
 *    이게 없으면 아무나 이 주소를 눌러 AI 비용을 태울 수 있어요.
 *  - `SUPABASE_SERVICE_ROLE_KEY` — 크론에는 로그인한 사람이 없어서 RLS 의
 *    `is_admin()` 을 통과할 수 없어요. 쓰기는 이 키로 해요.
 *
 * **둘 중 하나라도 없으면 아무 것도 하지 않고 무엇을 넣어야 하는지 알려줘요.**
 * 조용히 실패하면 "왜 재확인이 안 되지" 를 추측으로 찾게 되니까요.
 * 환경변수를 안 넣어도 관리자 화면의 "지금 재확인" 버튼은 그대로 동작해요
 * (그건 관리자 본인 세션으로 쓰니까요).
 */

/** 한 번에 몇 건까지. AI 호출이라 비용·시간이 들어서 조금씩 나눠서 봐요. */
const BATCH = 5;

/** 며칠 지나면 다시 볼지 */
const STALE_DAYS = 3;

export const maxDuration = 60;

function unauthorized(reason: string) {
  return NextResponse.json({ ok: false, error: reason }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        error: "CRON_SECRET 이 없어요.",
        hint: "Vercel → Settings → Environment Variables 에 CRON_SECRET 을 넣어주세요. 아무 긴 문자열이면 돼요. 없으면 아무나 이 주소로 AI 비용을 태울 수 있어서 막아뒀어요.",
      },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return unauthorized("Authorization 헤더가 맞지 않아요.");
  }
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY 가 없어요.",
        hint: "크론에는 로그인한 사람이 없어서 RLS 를 통과할 수 없어요. Supabase → Project Settings → API 의 service_role 키를 Vercel 환경변수에 넣어주세요. 그때까지는 관리자 화면의 '지금 재확인' 버튼을 쓰면 돼요.",
      },
      { status: 503 },
    );
  }
  if (!activeProvider()) {
    return NextResponse.json(
      { ok: false, error: "AI 키가 없어요. 웹 검색을 할 수 없어요." },
      { status: 503 },
    );
  }

  // 읽기는 공개 정보라 일반 클라이언트로 (비공개 초안까지 보려면 서비스 키가 필요해서
  // listPopups 대신 아래에서 서비스 클라이언트로 다시 읽어요)
  const admin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const all = await listPopups({ includeUnpublished: true });
  const targets = all
    .filter((p) => p.source === "db" && needsRecheck(p, { staleDays: STALE_DAYS }))
    // 한 번도 안 본 것 → 오래된 것 순
    .sort((a, b) => (a.lastCheckedAt ?? "").localeCompare(b.lastCheckedAt ?? ""))
    .slice(0, BATCH);

  const results: { id: string; title: string; changes: number; note: string }[] = [];
  for (const popup of targets) {
    try {
      const pending = diffRecheck(popup, await recheckPopup(snapshot(popup)));
      const { error } = await admin
        .from("popup_stores")
        .update({ last_checked_at: pending.checkedAt, pending_recheck: pending })
        .eq("id", popup.id);
      results.push({
        id: popup.id,
        title: popup.title,
        changes: pending.changes.length,
        note: error
          ? `저장 실패: ${error.message}`
          : pending.notFound
            ? "웹에서 못 찾음"
            : pending.changes.length === 0
              ? "그대로"
              : "변경 제안 생김",
      });
    } catch (error) {
      // 한 건이 실패해도 나머지는 계속 봐야 해요
      results.push({
        id: popup.id,
        title: popup.title,
        changes: 0,
        note: `실패: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: results.length,
    candidates: all.filter((p) => p.source === "db" && needsRecheck(p, { staleDays: STALE_DAYS })).length,
    staleDays: STALE_DAYS,
    results,
  });
}
