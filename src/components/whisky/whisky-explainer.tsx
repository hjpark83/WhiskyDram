import { GlossaryText } from "@/components/whisky/term";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { explainWhisky, oneLiner } from "@/lib/whisky/explain";
import type { Whisky } from "@/lib/whisky/types";

/**
 * `**굵게**` 만 지원하는 아주 작은 렌더러.
 *
 * 설명글에서 "이 단어 하나만은 눈에 들어왔으면" 하는 곳이 있는데, 그것 때문에
 * 마크다운 라이브러리를 넣기는 아까워요. 굵게 표시 밖의 글자는 그대로
 * `GlossaryText` 에 넘겨서 어려운 용어에 설명 팝오버가 붙게 해요.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-amber-100">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <GlossaryText key={i} text={part} />
        ),
      )}
    </>
  );
}

/** 여러 문단으로 된 글 */
function Paragraphs({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {text.split("\n\n").map((para, i) => (
        <p key={i} className="text-sm leading-7">
          <RichText text={para} />
        </p>
      ))}
    </div>
  );
}

/**
 * "이 위스키가 뭔가요" 설명.
 *
 * 향·맛·여운은 이미 보여주고 있지만, 처음 보는 사람에게 정작 필요한 건
 * **이게 어떤 종류의 술이고 왜 이런 맛이 나는지**예요.
 */
export function WhiskyExplainer({ whisky }: { whisky: Whisky }) {
  const blocks = explainWhisky(whisky);

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">이 위스키가 뭔가요?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[15px] leading-7 text-amber-50/90">
            <RichText text={oneLiner(whisky)} />
          </p>

          <dl className="grid gap-x-6 gap-y-3 border-t pt-4 sm:grid-cols-2">
            {blocks.map((block) => (
              <div key={block.label + block.text.slice(0, 8)}>
                <dt className="text-xs font-semibold text-amber-400">{block.label}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                  <RichText text={block.text} />
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* 브랜드 이야기는 사실 확인이 필요해서 사람이 적은 것만 있어요 */}
      {whisky.story && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{whisky.nameKo} 이야기</CardTitle>
          </CardHeader>
          <CardContent>
            <Paragraphs text={whisky.story} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}
