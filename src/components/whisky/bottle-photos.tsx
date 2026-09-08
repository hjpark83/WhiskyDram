import Image from "next/image";
import { BottleArt3D } from "@/components/whisky/bottle-art-3d";
import { creditLine } from "@/lib/whisky/commons";
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
 */
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
      <BottleArt3D
        whisky={whisky}
        size={176}
        className="shrink-0"
        labelUrl={seen?.labelUrl}
        liquidHex={seen?.liquidHex}
      />
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
    </div>
  );
}
