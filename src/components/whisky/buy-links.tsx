import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buyLinks, BUY_LINK_KIND_LABELS, SMART_ORDER_NOTE, type BuyLinkKind } from "@/data/buy-links";
import type { Whisky } from "@/lib/whisky/types";

/**
 * "어디서 사요?" 안내.
 *
 * 쇼핑몰 장바구니로 이어주지 않아요 — 한국은 주류 통신판매가 원칙적으로
 * 금지라 그런 곳이 없어요. 대신 합법 경로(스마트오더: 주문은 온라인, 수령은
 * 매장 대면)와 검색 링크만 이어주고, 그게 뭔지 화면에 적어둬요.
 */
export function BuyLinks({ whisky }: { whisky: Whisky }) {
  const links = buyLinks(whisky);
  const groups = links.reduce<Record<string, typeof links>>((acc, link) => {
    (acc[link.kind] ??= []).push(link);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">어디서 살 수 있나요</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(groups) as BuyLinkKind[]).map((kind) => (
          <div key={kind} className="space-y-2">
            <p className="text-xs font-medium text-amber-200/80">
              {BUY_LINK_KIND_LABELS[kind]}
            </p>
            {kind === "smart_order" && (
              <p className="text-xs leading-relaxed text-muted-foreground">{SMART_ORDER_NOTE}</p>
            )}
            <ul className="space-y-2">
              {groups[kind].map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border p-3 transition hover:border-amber-400/40"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {link.label}
                      <ExternalLink
                        className="size-3.5 text-muted-foreground group-hover:text-amber-300"
                        aria-hidden
                      />
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {link.hint}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="border-t pt-3 text-xs leading-relaxed text-muted-foreground">
          가격을 가져오지 않고 검색 주소만 이어줘요. 실제로 본 가격은{" "}
          <span className="text-amber-300">시세 제보</span>에 모여요.
        </p>
      </CardContent>
    </Card>
  );
}
