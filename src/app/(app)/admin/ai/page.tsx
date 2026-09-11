import type { Metadata } from "next";
import { Info, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { activeProvider, providerChain } from "@/lib/ai/provider";
import { CHECKS } from "@/lib/ai/self-check";
import { CheckView } from "./check-view";
import { ProbeView } from "./probe-view";

export const metadata: Metadata = { title: "AI 점검" };

// 점검은 실제 AI 호출이라 오래 걸려요 (서버 액션은 이 페이지의 제한을 따라요).
export const maxDuration = 60;

const ENV_ROWS: { name: string; note: string }[] = [
  { name: "AI_PROVIDER", note: "anthropic | openai | gemini. 비워두면 키가 있는 것 중에서 골라요." },
  { name: "ANTHROPIC_API_KEY", note: "Claude" },
  { name: "OPENAI_API_KEY", note: "ChatGPT" },
  { name: "GEMINI_API_KEY", note: "Gemini (GOOGLE_API_KEY 도 봐요)" },
  { name: "GEMINI_MODEL", note: "비워두면 gemini-3.5-flash" },
];

export default async function AdminAiPage() {
  const active = activeProvider();
  const chain = providerChain();
  const present = (name: string) => Boolean(process.env[name]?.trim());
  const baseUrl = process.env.GEMINI_BASE_URL?.trim();

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-amber-100">
            <Sparkles className="size-4 text-amber-400" aria-hidden />
            <h2 className="text-lg">지금 쓰는 AI</h2>
          </div>
          {active ? (
            <>
              <p className="text-sm text-amber-50/85">
                <strong className="font-semibold text-amber-100">{active.label}</strong> · 모델{" "}
                <code className="text-amber-300">{active.model}</code>
              </p>
              {chain.length > 1 ? (
                /* 전환 순서를 보여줘요. "왜 Gemini 라고 했는데 Claude 가 답했지?" 를
                   화면에서 바로 알 수 있어야 해요. */
                <p className="text-sm text-amber-50/85">
                  한도에 걸리면{" "}
                  <strong className="font-semibold text-amber-100">순서대로 넘어가요</strong>:{" "}
                  {chain.map((p, i) => (
                    <span key={p.id}>
                      {i > 0 && <span className="text-muted-foreground"> → </span>}
                      <code className="text-amber-300">{p.label}</code>
                    </span>
                  ))}
                </p>
              ) : (
                <p className="text-sm text-amber-100/70">
                  키가 하나뿐이라 이 프로바이더가 막히면 규칙 기반 결과로 떨어져요. 다른 프로바이더
                  키를 하나 더 넣어두면 한도에 걸려도 AI 응답이 계속 나와요.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-red-200">
              키가 하나도 없어요. 지금은 모든 AI 기능이 규칙 기반 결과로 돌아가요 (데모는 멈추지 않지만
              추천 문장이 정해진 문구예요).
            </p>
          )}
          {baseUrl && (
            <p className="flex gap-1.5 text-xs text-amber-100/70">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                GEMINI_BASE_URL 이 <code className="text-amber-300">{baseUrl}</code> 로 잡혀 있어요. 개발용
                가짜 서버 주소예요 — 배포 환경에는 없어야 해요.
              </span>
            </p>
          )}
          <dl className="grid gap-1.5 pt-1 text-sm">
            {ENV_ROWS.map((row) => (
              <div key={row.name} className="flex flex-wrap items-center gap-2">
                <Badge variant={present(row.name) ? "secondary" : "outline"} className="font-mono text-[11px]">
                  {row.name}
                </Badge>
                <span className={present(row.name) ? "text-xs text-amber-300" : "text-xs text-muted-foreground"}>
                  {present(row.name) ? "설정됨" : "없음"}
                </span>
                <span className="text-xs text-muted-foreground">— {row.note}</span>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            값은 보여주지 않고 설정됐는지만 확인해요. 환경변수를 고쳤으면 <strong>Production·Preview 양쪽</strong>에
            넣고 캐시 없이 다시 배포해야 반영돼요.
          </p>
        </CardContent>
      </Card>

      {active && <ProbeView />}

      <section className="space-y-3">
        <h2 className="text-lg text-amber-100">기능별 실제 호출 점검</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          아래 버튼을 누르면 각 기능이 쓰는 코드를 그대로 한 번씩 불러봐요. 키가 있어도 모델 이름이 틀리거나
          스키마를 못 받으면 조용히 규칙 기반 결과로 넘어가는데, 그걸 여기서 잡아요. 실제 호출이라 요금이
          조금 들고, 전체가 1~2분쯤 걸려요.
        </p>
        <CheckView checks={CHECKS} canRun={Boolean(active)} />
      </section>
    </div>
  );
}
