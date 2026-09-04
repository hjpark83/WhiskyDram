import { cn } from "@/lib/utils";
import { liquidColor, LIQUID_LABELS_KO } from "@/lib/whisky/format";
import type { Whisky } from "@/lib/whisky/types";

/** 위스키 색을 작은 잔 모양 스와치로. 스타일·숙성·통에서 추정한 값이에요. */
export function LiquidSwatch({
  whisky,
  size = "md",
  showLabel = false,
  className,
}: {
  whisky: Whisky;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const { hex, level } = liquidColor(whisky);
  const label = LIQUID_LABELS_KO[level];
  const dim = size === "lg" ? "size-10" : size === "md" ? "size-7" : "size-5";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={`색: ${label}`}>
      <span
        aria-hidden
        className={cn("inline-block shrink-0 rounded-b-full rounded-t-md border border-black/10 shadow-inner", dim)}
        style={{
          background: `linear-gradient(180deg, ${hex}cc 0%, ${hex} 60%, ${hex} 100%)`,
        }}
      />
      {showLabel && <span className="text-xs text-muted-foreground">{label}</span>}
    </span>
  );
}
