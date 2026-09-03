import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getWhiskies } from "@/data/whiskies";
import { decodeShare } from "@/lib/share";
import { describeProfile } from "@/lib/whisky/recommend";
import { AXIS_LABELS_KO, TASTE_AXES } from "@/lib/whisky/types";

export const runtime = "edge";

/** 필요한 글자만 담은 한글 폰트를 구글 폰트에서 받아요 (satori 는 woff2 를 못 읽어서 TTF 요청). */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`;
    const css = await fetch(url, {
      headers: {
        // 오래된 UA 로 요청하면 TTF 를 내려줘요
        "User-Agent":
          "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1",
      },
    }).then((r) => r.text());
    const m = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/);
    if (!m) return null;
    const res = await fetch(m[1]);
    return res.ok ? res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const data = decodeShare(params);
  const title = data?.title ?? "내 위스키 취향";
  const lines = data ? describeProfile(data.profile).slice(0, 3) : [];
  const whiskies = data ? getWhiskies(data.whiskyIds) : [];
  const axisLabels = TASTE_AXES.map((a) => AXIS_LABELS_KO[a]);

  const textForFont = [
    "나는 FirstDram AI 위스키 취향 진단 추천받은 첫 위스키 1분 진단 ",
    title,
    ...lines,
    ...whiskies.map((w) => w.nameKo),
    ...axisLabels,
    "0123456789-+.%",
  ].join("");
  const font = await loadFont(textForFont);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          fontFamily: font ? "NotoSansKR" : "sans-serif",
          color: "#1f2937",
          padding: 56,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, color: "#b45309" }}>
          <span>🥃</span>
          <span style={{ fontWeight: 700 }}>FirstDram</span>
          <span style={{ color: "#78716c" }}>· AI 위스키 취향 진단</span>
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, marginTop: 24, color: "#111827" }}>
          나는 “{title}”
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
          {lines.map((l) => (
            <div
              key={l}
              style={{
                display: "flex",
                fontSize: 24,
                background: "#fde68a",
                color: "#78350f",
                borderRadius: 999,
                padding: "8px 18px",
              }}
            >
              {l}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 28, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 480 }}>
            {data &&
              TASTE_AXES.map((a, i) => {
                const v = data.profile[a];
                const pct = (Math.abs(v) / 2) * 50;
                return (
                  <div key={a} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 20 }}>
                    <div style={{ display: "flex", width: 110, color: "#57534e" }}>{axisLabels[i]}</div>
                    <div style={{ display: "flex", position: "relative", flex: 1, height: 14, background: "#e7e5e4", borderRadius: 999 }}>
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          height: 14,
                          borderRadius: 999,
                          width: `${pct}%`,
                          left: v >= 0 ? "50%" : `${50 - pct}%`,
                          background: v >= 0 ? "#d97706" : "#94a3b8",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 22, color: "#57534e" }}>추천받은 첫 위스키</div>
            {whiskies.map((w) => (
              <div
                key={w.id}
                style={{
                  display: "flex",
                  fontSize: 26,
                  fontWeight: 700,
                  background: "white",
                  borderRadius: 16,
                  padding: "10px 18px",
                  border: "2px solid #fcd34d",
                }}
              >
                {w.nameKo}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 22, color: "#78716c", marginTop: 16 }}>
          커피·디저트 취향만 답하면 1분 진단
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: "NotoSansKR", data: font, weight: 700, style: "normal" }] : undefined,
    },
  );
}
