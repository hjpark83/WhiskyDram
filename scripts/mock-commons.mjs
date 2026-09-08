// 가짜 위키미디어 커먼즈 API.
//
// 커먼즈는 개발 환경에서 막혀 있을 수 있고, 실제 검색 결과는 그때그때 달라서
// 코드가 제대로 도는지 확인하기 어려워요. 그래서 **진짜 API 와 같은 모양의
// 응답**을 돌려주는 가짜 서버를 둬요.
//
// 여기서 중요한 건 응답이 예쁜 게 아니라 **실제 API 의 까다로운 점을 그대로
// 흉내내는 것**이에요. 안 그러면 여기서 통과해도 진짜에서 깨져요.
//   · extmetadata 값에 HTML 태그가 섞여 있어요 (<a href=...>이름</a>)
//   · 라이선스가 자유롭지 않은 파일도 섞여 나와요 (CC BY-NC 등)
//   · 라이선스 정보가 아예 없는 파일도 있어요
//   · pages 는 배열이 아니라 **id 를 키로 하는 객체**예요
//
//   node scripts/mock-commons.mjs 8788
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 8788);

const FILES = [
  {
    title: "File:Lagavulin 16 year old.jpg",
    artist: '<a href="https://commons.wikimedia.org/wiki/User:Someone" title="User:Someone">Someone</a>',
    license: "CC BY-SA 4.0",
  },
  {
    title: "File:Whisky glass on bar.jpg",
    artist: "<span>Anonymous</span>",
    license: "CC0",
  },
  {
    // 비상업 전용 — 우리 서비스에서는 못 써요. 걸러지는지 보려고 넣어요.
    title: "File:Distillery visitor centre.jpg",
    artist: "Photographer &amp; Friend",
    license: "CC BY-NC 2.0",
  },
  {
    // 라이선스 정보가 없는 파일. 모르면 안 쓰는 게 맞아요.
    title: "File:Old advert scan.jpg",
    artist: "",
    license: "",
  },
  {
    title: "File:Macallan bottle 12yo.jpg",
    artist: '<a href="#">Jane Doe</a>',
    license: "Public domain",
  },
];

createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const limit = Number(url.searchParams.get("gsrlimit") ?? 10);
  const width = url.searchParams.get("iiurlwidth") ?? "320";

  const pages = {};
  FILES.slice(0, limit).forEach((f, i) => {
    const name = encodeURIComponent(f.title.replace(/^File:/, "").replace(/ /g, "_"));
    const extmetadata = {};
    // 진짜 API 도 값이 없으면 키 자체를 안 보내요
    if (f.artist) extmetadata.Artist = { value: f.artist };
    if (f.license) extmetadata.LicenseShortName = { value: f.license };

    pages[String(1000 + i)] = {
      pageid: 1000 + i,
      ns: 6,
      title: f.title,
      imageinfo: [
        {
          url: `http://127.0.0.1:${port}/img/${name}`,
          thumburl: `http://127.0.0.1:${port}/img/${width}px-${name}`,
          descriptionurl: `http://127.0.0.1:${port}/wiki/${name}`,
          extmetadata,
        },
      ],
    };
  });

  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ batchcomplete: "", query: { pages } }));
}).listen(port, "127.0.0.1", () => {
  console.log(`mock commons on http://127.0.0.1:${port}`);
});
