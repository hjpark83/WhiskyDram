import Link from "next/link";
import { Camera, Compass, NotebookPen, MapPin, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Compass,
    title: "1분 취향 진단",
    body: "커피, 과일, 훈제 음식… 일상적인 질문 몇 개로 내 입맛에 맞는 첫 위스키 3병을 골라드려요.",
  },
  {
    icon: Camera,
    title: "병 사진으로 바로 해설",
    body: "마트에서 찍은 사진 한 장이면 어떤 맛인지, 지금 내 취향에 맞는지 쉬운 말로 알려드려요.",
  },
  {
    icon: NotebookPen,
    title: "마실수록 똑똑해지는 추천",
    body: "\"피트는 별로, 과일향이 좋았어요\" 한 줄이면 취향을 다시 분석해 다음 병을 추천해요.",
  },
  {
    icon: MapPin,
    title: "증류소 지도",
    body: "추천받은 위스키가 어디서 태어났는지, 지도에서 이야기와 함께 살펴보세요.",
  },
  {
    icon: BookOpen,
    title: "어려운 말은 클릭 한 번",
    body: "피트, 셰리 캐스크, 피니시… 모르는 용어는 눌러서 바로 확인하세요.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold">🥃 FirstDram</span>
        <Button variant="ghost" render={<Link href="/login" />}>
          로그인
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-20 pt-16 text-center">
        <p className="mb-4 text-sm font-medium text-amber-700">
          Your first dram, chosen for you.
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          위스키, 뭐부터
          <br />
          마셔야 할지 모르겠다면
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          전문 용어 없이, 내 입맛에 맞는 첫 잔을 찾아드려요. 마신 후기를 남길수록
          추천은 더 정확해집니다.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="w-full px-6 sm:w-auto"
            render={<Link href="/login?next=/quiz" />}
          >
            취향 진단 시작하기
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full px-6 sm:w-auto"
            render={<Link href="/login?next=/scan" />}
          >
            병 사진으로 찾기
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="space-y-3 p-6">
              <Icon className="size-6 text-amber-700" aria-hidden />
              <h2 className="font-semibold">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        FirstDram · Wanted AI Challenge 2026 · 술은 성인만, 적당히.
      </footer>
    </main>
  );
}
