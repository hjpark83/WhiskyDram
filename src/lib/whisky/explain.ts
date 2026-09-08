import {
  DIFFICULTY_LABELS_KO,
  REGION_LABELS_KO,
  STYLE_LABELS_KO,
} from "@/lib/whisky/format";
import type { Region, StyleTag, Whisky, WhiskyType } from "@/lib/whisky/types";

/**
 * "이 위스키가 대체 뭔가요?" 에 대한 설명.
 *
 * 향·맛·여운은 이미 보여주고 있는데, 처음 보는 사람에게 정작 필요한 건
 * **이게 어떤 종류의 술이고 왜 이런 맛이 나는지**예요. 바 메뉴판의 설명글이
 * 하는 역할이죠.
 *
 * 504병에 사람이 일일이 글을 쓸 수는 없고, 그렇다고 AI 로 브랜드 역사를
 * 지어내게 하면 틀린 사실이 섞여요. 그래서 **이미 가지고 있는 사실**
 * (종류·산지·숙성 연수·통 종류·도수)에서 규칙으로 문장을 만들어요.
 * 지어내는 게 하나도 없어서 504병 전부에 안전하게 붙어요.
 *
 * 브랜드 이야기처럼 사실 확인이 필요한 내용은 `Whisky.story` 에 사람이
 * 적은 것만 보여줘요 (없으면 안 보여줘요).
 */

// ---------------------------------------------------------------------------
// 재료 설명
// ---------------------------------------------------------------------------

/** 종류가 뜻하는 것 — "싱글 몰트" 가 무슨 말인지부터 */
const TYPE_MEANING_KO: Record<WhiskyType, string> = {
  single_malt:
    "**한 증류소에서 보리(맥아)만으로** 만든 위스키예요. 여러 증류소 술을 섞지 않아서 그 증류소의 개성이 그대로 나와요.",
  blended_scotch:
    "여러 증류소의 술을 **섞어서** 맛을 맞춘 위스키예요. 튀는 구석 없이 부드러워서 처음 마시기 좋고, 값도 대체로 싼 편이에요.",
  bourbon:
    "미국 위스키예요. **옥수수를 절반 이상** 쓰고 **속을 태운 새 오크통**에만 익혀요. 그래서 바닐라·캐러멜 같은 단 향이 진하게 나요.",
  rye: "미국 위스키인데 **호밀**을 많이 써요. 버번보다 달지 않고 후추처럼 알싸한 맛이 도드라져요.",
  irish:
    "아일랜드 위스키예요. 보통 **세 번 증류**해서 스카치보다 부드럽고 가벼운 편이에요.",
  japanese:
    "일본 위스키예요. 스카치 방식을 따르되 더 섬세하고 균형 잡힌 맛을 지향해요. 하이볼로 마시기 좋게 만든 병도 많아요.",
  other: "위 분류에 딱 들어맞지 않는 위스키예요.",
};

/** 통이 맛에 하는 일 — 왜 이런 맛이 나는지의 대부분이 여기서 결정돼요 */
const CASK_EFFECT_KO: Record<StyleTag, string> = {
  sherry:
    "셰리(스페인 단맛 와인)를 담았던 통에서 익혔어요. 그래서 건포도·초콜릿 같은 **진하고 달큰한 맛**이 배어요.",
  bourbon_cask:
    "버번을 담았던 통에서 익혔어요. **바닐라·꿀 같은 가벼운 단맛**이 나고 전체적으로 산뜻해요.",
  wine_cask:
    "와인을 담았던 통에서 익혔어요. 베리 잼 같은 **새콤달콤한 과일 맛**이 더해져요.",
  peated:
    "보리를 말릴 때 **이탄(피트)**을 태운 연기를 씌웠어요. 그래서 모닥불·훈제 같은 연기 향이 나요. 호불호가 가장 크게 갈리는 특징이에요.",
  high_proof:
    "물을 많이 타지 않고 **도수를 높게** 담았어요. 향이 진한 대신 목이 화끈해서, 물을 몇 방울 섞으면 향이 풀려요.",
  highball:
    "탄산수에 섞어 마시기 좋게 가볍게 만든 병이에요. 그대로 마셔도 되지만 하이볼로 진가가 나와요.",
};

/** 산지 특징 — 같은 스코틀랜드도 지역마다 성격이 달라요 */
const REGION_CHARACTER_KO: Partial<Record<Region, string>> = {
  Speyside: "스코틀랜드에서 증류소가 가장 빽빽한 곳이에요. 과일 향이 나고 순한 술이 많아 입문용으로 많이 꼽혀요.",
  Islay: "바다 건너 작은 섬이에요. 이탄을 태워 만드는 연기 향 위스키의 본고장이라, 여기 술은 대체로 강렬해요.",
  Highland: "면적이 넓은 만큼 증류소마다 성격이 제각각이에요. 가벼운 것부터 묵직한 것까지 다 나와요.",
  Lowland: "스코틀랜드 남쪽이에요. 가볍고 부드러운 술이 많아 부담 없이 마시기 좋아요.",
  Campbeltown: "한때 증류소가 넘쳤던 항구 도시예요. 지금은 몇 곳 안 남았고, 짭짤하고 기름진 맛으로 알려져 있어요.",
  Islands: "스코틀랜드 여러 섬을 묶어 부르는 말이에요. 바닷바람 때문인지 짭짤한 느낌이 도는 술이 많아요.",
  Kentucky: "미국 버번의 본고장이에요. 미국 버번의 대부분이 이 지역에서 나와요.",
  Tennessee: "버번과 비슷하게 만들되 통에 넣기 전 **단풍나무 숯으로 걸러요.** 그래서 더 부드러워요.",
  Ireland: "위스키를 가장 먼저 만들었다고 주장하는 곳 중 하나예요. 부드러운 술이 많아요.",
  Japan: "100년 남짓 된 젊은 산지인데, 지금은 세계 대회에서 상을 휩쓸 만큼 인정받아요.",
};

/**
 * 테네시 위스키는 분류상 버번과 같은 칸(`bourbon`)에 있지만 **버번이 아니에요.**
 * 통에 넣기 전 숯으로 거르는 공정이 하나 더 있어서 따로 부르거든요.
 * 그냥 두면 "이건 버번이에요" 라고 잘못 설명하게 돼요.
 */
const TENNESSEE_MEANING_KO =
  "미국 테네시 위스키예요. 버번과 만드는 법이 거의 같지만, 통에 넣기 전 **단풍나무 숯으로 한 번 걸러요.** 그 공정 때문에 버번이 아니라 테네시 위스키로 따로 불러요. 거친 맛이 깎여서 더 부드러워요.";

export interface ExplainBlock {
  label: string;
  text: string;
}

/** 도수가 마실 때 어떤 뜻인지 */
function abvText(abv: number): string {
  if (abv >= 55) return `${abv}도로 아주 높아요. 그대로 마시면 향보다 알코올이 먼저 와요 — 물을 조금 섞어보세요.`;
  if (abv >= 50) return `${abv}도로 센 편이에요. 얼음이나 물 몇 방울이면 훨씬 편해져요.`;
  if (abv >= 46) return `${abv}도예요. 위스키 치고 살짝 높은 편이라 향이 진하게 올라와요.`;
  if (abv >= 43) return `${abv}도예요. 위스키에서 가장 흔한 도수대로, 무난해요.`;
  return `${abv}도로 낮은 편이에요. 부담이 적어서 처음 마시기 좋고 하이볼로도 잘 어울려요.`;
}

/** 숙성 연수가 뜻하는 것 */
function ageText(age: number | null, limited?: boolean): string {
  if (age === null) {
    // 한정판(싱글 캐스크)은 통 하나에서만 나온 술이라 "여러 해를 섞었다" 가 틀려요
    return limited
      ? "병에 숙성 연수가 안 적혀 있어요(NAS). 어리거나 나쁘다는 뜻은 아니에요."
      : "병에 숙성 연수가 안 적혀 있어요(NAS). 여러 해의 술을 섞어 맛을 맞췄다는 뜻이지, 어리거나 나쁘다는 뜻은 아니에요.";
  }
  const base = `**최소 ${age}년** 익혔어요. 섞인 술 중 가장 어린 것이 ${age}년이라는 뜻이에요.`;
  if (age >= 21) return `${base} 이 정도면 아주 오래 익힌 축이라 값도 크게 올라가요.`;
  if (age >= 15) return `${base} 오래 익힌 만큼 나무 향이 깊고 목넘김이 부드러워요.`;
  if (age >= 12) return `${base} 위스키에서 가장 흔한 연수대예요.`;
  return `${base} 짧게 익힌 만큼 원래 재료의 맛이 살아 있어요.`;
}

/**
 * 한 줄 정의. "이게 뭔 술이냐" 에 대한 제일 짧은 답.
 * 아는 사실만 이어 붙여서 만들어요.
 */
export function oneLiner(w: Whisky): string {
  // 테네시는 종류 이름에 지역이 이미 들어가 있어서 빼요 ("미국 테네시에서 온 테네시 위스키")
  const where =
    w.region !== "Other" && w.region !== "Tennessee" && REGION_LABELS_KO[w.region]
      ? `${w.country} ${REGION_LABELS_KO[w.region]}`
      : w.country;

  const kind =
    w.region === "Tennessee"
      ? "테네시 위스키"
      : w.type === "single_malt"
        ? "싱글 몰트 위스키"
        : w.type === "blended_scotch"
          ? "블렌디드 위스키"
          : w.type === "bourbon"
            ? "버번"
            : w.type === "rye"
              ? "라이 위스키"
              : w.type === "japanese"
                ? "일본 위스키"
                : w.type === "irish"
                  ? "아일랜드 위스키"
                  : "위스키";

  const made =
    w.type === "single_malt"
      ? "한 증류소에서 보리로만 만들어"
      : w.type === "blended_scotch"
        ? "여러 증류소의 술을 섞어"
        : w.type === "bourbon" || w.type === "rye"
          ? "곡물을 발효해 증류하고"
          : "증류해";
  const aged = w.age !== null ? `최소 ${w.age}년 익혔어요` : "숙성 연수는 따로 적지 않았어요";

  // 맛을 가장 크게 좌우하는 특징 하나만 덧붙여요
  const hook = w.styles.includes("peated")
    ? " 연기 향이 나는 게 가장 큰 특징이에요."
    : w.styles.includes("sherry")
      ? " 셰리 통에서 익혀 진한 단맛이 나요."
      : w.styles.includes("wine_cask")
        ? " 와인 통에서 익혀 과일 맛이 도드라져요."
        : w.flavor.sweet >= 4
          ? " 단맛이 뚜렷한 편이에요."
          : "";

  return `${where}에서 온 ${kind}예요. ${made} ${aged}.${hook}`;
}

/** 상세 화면에 줄줄이 보여줄 설명 블록들 */
export function explainWhisky(w: Whisky): ExplainBlock[] {
  const blocks: ExplainBlock[] = [
    {
      label: "종류",
      text: w.region === "Tennessee" ? TENNESSEE_MEANING_KO : TYPE_MEANING_KO[w.type],
    },
    { label: "숙성", text: ageText(w.age, w.limited) },
  ];

  const character = REGION_CHARACTER_KO[w.region];
  if (character) blocks.push({ label: REGION_LABELS_KO[w.region], text: character });

  // 통은 맛을 가장 크게 좌우해서 하나씩 따로 설명해요
  for (const tag of w.styles) {
    blocks.push({ label: STYLE_LABELS_KO[tag], text: CASK_EFFECT_KO[tag] });
  }

  blocks.push({ label: "도수", text: abvText(w.abv) });
  blocks.push({
    label: "난이도",
    text: `${DIFFICULTY_LABELS_KO[w.difficulty]}. ${
      w.difficulty <= 2
        ? "위스키를 처음 마셔도 무리 없어요."
        : w.difficulty === 3
          ? "몇 병 마셔본 뒤에 도전하면 좋아요."
          : "개성이 강해서 처음 마시는 술로는 권하지 않아요."
    }`,
  });

  return blocks;
}
