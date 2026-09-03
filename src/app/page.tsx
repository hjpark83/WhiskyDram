import Link from "next/link";
import {
  BookOpen,
  Camera,
  Compass,
  GitCompareArrows,
  Globe2,
  MessageCircle,
  Search,
  NotebookPen,
  Share2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LiquidSwatch } from "@/components/whisky/liquid-swatch";
import { TasteBars } from "@/components/whisky/taste-bars";
import { getDistilleries } from "@/data/distilleries";
import { GLOSSARY } from "@/data/glossary";
import { getWhiskies, WHISKIES } from "@/data/whiskies";
import { formatPriceRange, TYPE_SHORT_KO } from "@/lib/whisky/format";
import type { TasteProfile } from "@/lib/whisky/types";

const SAMPLE_PROFILE: TasteProfile = { peat: -1, fruit: 2, sweet: 2, spice: 0, floral: 1, oak: 0, body: -1 };
const SAMPLE_PICKS = ["glenfiddich-12", "glenmorangie-10", "monkey-shoulder"];

const steps = [
  {
    n: "1",
    title: "일상 질문 7개에 답해요",
    body: "커피는 라떼파인지, 훈제 연어를 좋아하는지. 위스키 용어는 하나도 안 나와요.",
  },
  {
    n: "2",
    title: "AI 소믈리에가 3병을 골라요",
    body: "312병 사전에서 예산·경험에 맞는 후보를 추리고, 왜 이 병인지 내 답변을 근거로 설명해요.",
  },
  {
    n: "3",
    title: "마신 후기로 취향이 자라요",
    body: "한 줄 후기면 취향 프로필이 갱신되고 다음 3병이 바뀌어요. 마실수록 정확해져요.",
  },
];

const features = [
  { icon: Compass, title: "1분 취향 진단", body: "일상 질문만으로 첫 위스키 3병. 예산과 경험까지 맞춰요." },
  { icon: MessageCircle, title: "AI 소믈리에 채팅", body: "“삼겹살에 뭐 마시지?” 물어보면 사전에서 찾아 답해요." },
  { icon: Camera, title: "병 사진 스캔", body: "마트에서 찍은 라벨 한 장으로 어떤 병인지, 내 취향에 맞는지 판정." },
  { icon: NotebookPen, title: "테이스팅 노트", body: "“연기는 별로, 단맛은 좋았어요” 한 줄이 취향 프로필을 바꿔요." },
  { icon: Globe2, title: "지구본 증류소 지도", body: "지구본을 돌려 108곳 증류소를 찾고, 그곳의 병을 살펴봐요." },
  { icon: Search, title: "312병 위스키 사전", body: "원산지·종류·스타일로 걸러 보고, 카드마다 내 취향 적합도가 보여요." },
  { icon: GitCompareArrows, title: "두 병 비교", body: "고민되는 두 병을 나란히 놓고 향미·가격·도수를 비교해요." },
  { icon: Share2, title: "결과 공유 카드", body: "“나는 달콤한 과일파” 카드를 친구에게 보내고 같이 진단해요." },
  { icon: BookOpen, title: "어려운 말은 클릭 한 번", body: "피트, 셰리 캐스크… 본문 속 용어를 누르면 바로 설명이 떠요." },
];

export default function LandingPage() {
  const picks = getWhiskies(SAMPLE_PICKS);
  const stats = [
    { n: WHISKIES.length, label: "병 사전" },
    { n: getDistilleries().length, label: "증류소" },
    { n: GLOSSARY.length, label: "용어 풀이" },
  ];

  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="brand text-xl font-bold text-amber-300">🥃 FirstDram</span>
        <Button variant="ghost" render={<Link href="/login" />}>
          로그인
        </Button>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 pb-16 pt-10 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <p className="mb-4 text-sm font-medium text-amber-400">Your first dram, chosen for you.</p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            위스키, 뭐부터
            <br />
            마셔야 할지 모르겠다면
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            전문 용어 없이, 내 입맛에 맞는 첫 잔을 찾아드려요. 마신 후기를 남길수록 추천은 더
            정확해집니다.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="px-6" render={<Link href="/login?next=/quiz" />}>
              <Sparkles data-icon="inline-start" />
              1분 취향 진단 시작
            </Button>
            <Button size="lg" variant="outline" className="px-6" render={<Link href="/login?next=/scan" />}>
              <Camera data-icon="inline-start" />
              병 사진으로 찾기
            </Button>
          </div>
          <dl className="mt-10 flex gap-8">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-2xl font-bold tabular-nums">{s.n}</dt>
                <dd className="text-xs text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* 예시 결과 카드 */}
        <Card className="animate-in fade-in slide-in-from-bottom-6 gap-0 overflow-hidden border-amber-400/40 py-0 shadow-lg glow-amber duration-700 delay-150">
          <div className="rounded-t-xl bg-amber-500 px-5 py-4 text-amber-950">
            <p className="flex items-center gap-1.5 text-xs opacity-90">
              <Sparkles className="size-3.5" /> 진단 결과 예시
            </p>
            <p className="mt-1 text-2xl font-bold">당신은 “달콤한 과일파”</p>
          </div>
          <CardContent className="space-y-4 p-5">
            <p className="text-sm text-muted-foreground">
              라떼와 과일 타르트를 고르셨다니, 부드럽고 달콤한 쪽이 잘 맞을 거예요. 연기 향은 나중에.
            </p>
            <TasteBars profile={SAMPLE_PROFILE} />
            <ul className="grid gap-2 sm:grid-cols-3">
              {picks.map((w) => (
                <li key={w.id} className="rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <LiquidSwatch whisky={w} size="sm" />
                    <p className="truncate text-sm font-semibold">{w.nameKo}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {TYPE_SHORT_KO[w.type]} · {formatPriceRange(w.priceKrw)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* How it works */}
      <section className="border-y bg-amber-500/10">
        <div className="mx-auto grid max-w-5xl gap-6 px-6 py-14 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 font-bold text-amber-950">
                {s.n}
              </span>
              <div>
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-6 text-2xl font-bold">찾고, 묻고, 마시고, 기록하고</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="transition-transform hover:-translate-y-0.5 hover:border-amber-400/50">
              <CardContent className="space-y-3 p-6">
                <Icon className="size-6 text-amber-400" aria-hidden />
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <h2 className="text-2xl font-bold">첫 잔은 실패하지 않게</h2>
        <p className="mt-2 text-muted-foreground">회원가입 후 1분이면 내 첫 위스키 3병이 나와요.</p>
        <Button size="lg" className="mt-6 px-8" render={<Link href="/login?next=/quiz" />}>
          지금 시작하기
        </Button>
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        FirstDram · Wanted AI Challenge 2026 · 술은 성인만, 적당히.
      </footer>
    </main>
  );
}
