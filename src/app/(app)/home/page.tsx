import Link from "next/link";
import { Camera, Compass, NotebookPen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const actions = [
  {
    href: "/quiz",
    icon: Compass,
    title: "취향 진단하기",
    body: "1분이면 끝나요. 내 첫 위스키 3병을 추천받으세요.",
  },
  {
    href: "/scan",
    icon: Camera,
    title: "병 사진 찍기",
    body: "마트나 바에서 보이는 그 병, 지금 내 취향에 맞을까요?",
  },
  {
    href: "/journal",
    icon: NotebookPen,
    title: "마신 후기 남기기",
    body: "한 줄만 남겨도 다음 추천이 달라져요.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">오늘은 어떤 잔을 찾아볼까요?</h1>
        <p className="mt-1 text-muted-foreground">
          아직 취향 프로필이 없어요. 진단부터 시작해보세요.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {actions.map(({ href, icon: Icon, title, body }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-amber-600/60">
              <CardContent className="space-y-3 p-6">
                <Icon className="size-6 text-amber-700" aria-hidden />
                <h2 className="font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{body}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
