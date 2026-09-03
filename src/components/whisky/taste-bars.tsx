import { cn } from "@/lib/utils";
import {
  AXIS_LABELS_KO,
  TASTE_AXES,
  type FlavorProfile,
  type TasteProfile,
} from "@/lib/whisky/types";

/** 사용자 취향(-2..+2). 가운데가 0, 오른쪽이 좋아함. */
export function TasteBars({
  profile,
  className,
}: {
  profile: TasteProfile;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-2", className)}>
      {TASTE_AXES.map((axis) => {
        const v = profile[axis] ?? 0;
        const pct = (Math.abs(v) / 2) * 50; // 한쪽 절반 기준 %
        return (
          <li key={axis} className="grid grid-cols-[5.5rem_1fr_2.5rem] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{AXIS_LABELS_KO[axis]}</span>
            <div className="relative h-2 rounded-full bg-muted">
              <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
              <span
                className={cn(
                  "absolute top-0 h-full rounded-full",
                  v >= 0 ? "left-1/2 bg-amber-600" : "right-1/2 bg-slate-400",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-right tabular-nums text-muted-foreground">
              {v > 0 ? `+${v}` : v}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 위스키 향미(0..5) */
export function FlavorBars({
  flavor,
  className,
  compact = false,
}: {
  flavor: FlavorProfile;
  className?: string;
  compact?: boolean;
}) {
  return (
    <ul className={cn(compact ? "space-y-1" : "space-y-2", className)}>
      {TASTE_AXES.map((axis) => {
        const v = flavor[axis] ?? 0;
        return (
          <li
            key={axis}
            className={cn(
              "grid items-center gap-3",
              compact
                ? "grid-cols-[4.5rem_1fr] text-xs"
                : "grid-cols-[5.5rem_1fr_1.5rem] text-sm",
            )}
          >
            <span className="text-muted-foreground">{AXIS_LABELS_KO[axis]}</span>
            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2 flex-1 rounded-full",
                    i < v ? "bg-amber-600" : "bg-muted",
                  )}
                />
              ))}
            </div>
            {!compact && (
              <span className="text-right tabular-nums text-muted-foreground">{v}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
