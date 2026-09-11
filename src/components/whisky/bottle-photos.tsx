import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { BottleArt3D } from "@/components/whisky/bottle-art-3d";
import { creditLine } from "@/lib/whisky/commons";
import { photoSearchUrl } from "@/lib/whisky/photo-search";
import type { WhiskyPhoto } from "@/lib/whisky/photos";
import type { Whisky } from "@/lib/whisky/types";

/**
 * 실물 병 사진. 없으면 입체 병 그림으로 대신해요.
 *
 * 사진은 사용자가 병을 스캔할 때 올린 것이에요. 판매 사이트 제품 이미지를
 * 못 쓰는 대신, 실제로 그 병을 산 사람이 찍은 사진이 쌓이는 구조예요.
 *
 * **사진이 있으면 사진이 우선이에요.** 3D 는 잘 만들어도 실물이 아니라서,
 * "이 병이 그 병인가" 를 확인하는 데는 사진을 이길 수 없어요. 3D 는 사진이
 * 아직 없는 병에서 액체 색과 병 모양을 보여주는 역할이에요.
 *
 * 그래서 **어느 경우든 실물 사진을 찾아볼 링크를 같이 둬요** (구글 이미지 검색).
 * 3D 만 보여주고 끝내면 "실제로는 어떻게 생겼는데?" 에 답이 없고, 사진이 한 장
 * 있는 경우에도 각도가 하나뿐이라 더 보고 싶을 수 있어요. 우리가 남의 사진을
 * 가져다 쓰지 않고 검색으로 보내기만 하니 저작권 문제도 없어요
 * (`src/lib/whisky/photo-search.ts`).
 */
/** 실물 사진 찾아보기 (구글 이미지) — 사진이 있든 없든 같이 보여줘요 */
function PhotoSearchLink({ whisky }: { whisky: Whisky }) {
  return (
    <a
      href={photoSearchUrl(whisky)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-amber-300"
    >
      실물 사진 보기
      <ExternalLink className="size-2.5" aria-hidden />
    </a>
  );
}

export function BottlePhotos({
  whisky,
  photos,
}: {
  whisky: Whisky;
  photos: WhiskyPhoto[];
}) {
  const cover = photos[0];

  if (!cover) {
    // 사진이 아직 공개되지 않았어도, 거기서 꺼낸 라벨·색은 3D 에 쓸 수 있어요.
    // 그래야 스캔 한 번이 바로 눈에 보이는 변화로 이어져요.
    const seen = photos.find((p) => p.labelUrl || p.liquidHex);
    return (
      <div className="shrink-0 space-y-1">
        <BottleArt3D
          whisky={whisky}
          size={176}
          labelUrl={seen?.labelUrl}
          liquidHex={seen?.liquidHex}
        />
        {/* 3D 는 그림이에요. 실물이 궁금하면 여기로 — 이게 없으면 답이 없어요 */}
        <PhotoSearchLink whisky={whisky} />
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-1">
      <div className="relative h-32 w-24 overflow-hidden rounded-lg border bg-black/20">
        <Image
          src={cover.url}
          alt={`${whisky.nameKo} 실물 사진`}
          fill
          sizes="96px"
          className="object-contain"
          unoptimized
        />
      </div>
      {!cover.approved && (
        // 본인만 보이는 상태예요. 안 알려주면 "왜 나만 보이지?" 하게 돼요.
        <p className="text-center text-[10px] text-muted-foreground">확인 대기 중</p>
      )}
      {cover.source === "commons" && (
        // 출처 표기는 라이선스가 요구하는 조건이에요. 빼면 쓸 수 없어요.
        <p className="max-w-24 text-center text-[10px] leading-tight text-muted-foreground">
          {cover.sourceUrl ? (
            <a
              href={cover.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-amber-300 hover:underline"
            >
              {creditLine(cover)}
            </a>
          ) : (
            creditLine(cover)
          )}
        </p>
      )}
      {photos.length > 1 && (
        <p className="text-center text-[10px] text-muted-foreground">사진 {photos.length}장</p>
      )}
      <PhotoSearchLink whisky={whisky} />
    </div>
  );
}
