import { WHISKIES } from "@/data/whiskies";
import type { Region, Whisky } from "@/lib/whisky/types";

/**
 * 증류소(또는 브랜드 소유 회사) 메타데이터.
 * key 는 whiskies.ts 의 `distillery` 문자열과 정확히 같아야 해요.
 * 좌표는 위스키 데이터에서 파생하고, 여기엔 사람이 읽을 정보만 둬요.
 */
export interface DistilleryMeta {
  nameKo: string;
  founded: number | null;
  blurb: string; // 초보자용 한 줄 소개
}

export const DISTILLERY_META: Record<string, DistilleryMeta> = {
  // ── 사전 확장(500병)과 함께 추가된 증류소들 ──
  BenRiach: { nameKo: "벤리악", founded: 1898, blurb: "스페이사이드인데 피트도 만들어요. 열대과일 향으로 유명해요." },
  Knockando: { nameKo: "녹칸두", founded: 1898, blurb: "게일어로 '작은 검은 언덕'. J&B 블렌드의 핵심 원액이에요." },
  Linkwood: { nameKo: "링크우드", founded: 1821, blurb: "꽃 향으로 이름난 곳. 블렌더들이 아끼는 원액이에요." },
  Longmorn: { nameKo: "롱몬", founded: 1894, blurb: "애호가들이 조용히 아끼는 스페이사이드의 숨은 강자." },
  "Glen Elgin": { nameKo: "글렌 엘긴", founded: 1898, blurb: "꿀 향이 진해요. 화이트 호스 블렌드의 심장." },
  Tomintoul: { nameKo: "토민타울", founded: 1964, blurb: "'가장 부드러운 몰트'가 별명. 스코틀랜드에서 가장 높은 마을 근처." },
  "The Glenrothes": { nameKo: "글렌로시스", founded: 1878, blurb: "둥근 병으로 유명해요. 셰리 숙성에 공을 들이는 곳." },
  Aultmore: { nameKo: "올트모어", founded: 1896, blurb: "베인 풀 같은 향. 아주 깨끗한 스타일이에요." },
  "The Dalmore": { nameKo: "달모어", founded: 1839, blurb: "사슴뿔 로고. 셰리와 오렌지 향의 고급 라인으로 유명해요." },
  "Old Pulteney": { nameKo: "올드 풀트니", founded: 1826, blurb: "청어잡이 항구 마을의 증류소. 바닷바람 같은 짠맛이 특징." },
  Glencadam: { nameKo: "글렌캐덤", founded: 1825, blurb: "'더 크리미한 하이랜드'. 가볍고 깨끗한 스타일이에요." },
  "Royal Lochnagar": { nameKo: "로열 로크나가", founded: 1845, blurb: "밸모럴 성 근처. 왕실 인증을 받은 작은 증류소예요." },
  "Blair Athol": { nameKo: "블레어 아솔", founded: 1798, blurb: "벨즈 블렌드의 심장. 진한 몰트 향이 특징이에요." },
  Knockdhu: { nameKo: "녹두 (안녹)", founded: 1894, blurb: "위스키 이름은 안녹(anCnoc), 증류소 이름은 녹두예요." },
  Balblair: { nameKo: "발블레어", founded: 1790, blurb: "영화 '앤젤스 셰어'에 나온 증류소. 균형이 좋아요." },
  "Ben Nevis": { nameKo: "벤 네비스", founded: 1825, blurb: "영국 최고봉 아래. 개성이 강해 호불호가 갈려요." },
  Wolfburn: { nameKo: "울프번", founded: 2013, blurb: "스코틀랜드 최북단 증류소. 2013년에 다시 문을 열었어요." },
  Tullibardine: { nameKo: "툴리바딘", founded: 1949, blurb: "와인 통 마무리를 즐겨 써요. 값이 착한 편이에요." },
  "The Glenturret": { nameKo: "글렌터렛", founded: 1763, blurb: "가장 오래된 증류소 중 하나. 아직도 손으로 저어 만들어요." },
  Teaninich: { nameKo: "티니니크", founded: 1817, blurb: "후추 같은 알싸함이 특징. 단맛이 적은 드라이한 스타일." },
  "Isle of Raasay": { nameKo: "아일 오브 라세이", founded: 2017, blurb: "스카이 옆 작은 섬. 피트와 논피트를 섞어 내요." },
  "Ailsa Bay": { nameKo: "아일사 베이", founded: 2007, blurb: "단맛과 연기 정도를 숫자로 표시하는 독특한 브랜드." },
  "Lindores Abbey": { nameKo: "린도어스 애비", founded: 2017, blurb: "1494년 위스키 최초 기록이 남은 수도원 자리에 지었어요." },
  "The Clydeside": { nameKo: "클라이드사이드", founded: 2017, blurb: "글래스고 강가의 도시형 증류소. 여행 코스로 인기예요." },
  "Roe & Co": { nameKo: "로 앤 코", founded: 2019, blurb: "더블린 옛 발전소를 고쳐 만든 증류소. 칵테일용으로 유명해요." },
  Kilbeggan: { nameKo: "킬베간", founded: 1757, blurb: "가장 오래된 면허를 가진 아일랜드 증류소예요." },
  "Knappogue Castle": { nameKo: "나포그 캐슬", founded: 1966, blurb: "성 이름을 딴 브랜드. 삼중 증류의 부드러움이 특징." },
  Glendalough: { nameKo: "글렌달록", founded: 2011, blurb: "위클로 산의 작은 증류소. 값이 착하고 부드러워요." },
  Waterford: { nameKo: "워터포드", founded: 2015, blurb: "'어느 밭 보리인가'를 추적하는 독특한 증류소예요." },
  "Old Forester": { nameKo: "올드 포레스터", founded: 1870, blurb: "미국에서 가장 오래된 버번 브랜드 중 하나예요." },
  Westward: { nameKo: "웨스트워드", founded: 2004, blurb: "포틀랜드의 크래프트 맥주 문화에서 나온 미국식 싱글몰트." },
  "Stranahan's": { nameKo: "스트라나한스", founded: 2004, blurb: "콜로라도 산의 싱글몰트. 눈 녹은 물로 만든다고 해요." },
  Templeton: { nameKo: "템플턴", founded: 2006, blurb: "아이오와의 라이 위스키. 금주법 시절 밀주로 유명했던 지역." },
  "Mars Tsunuki": { nameKo: "마르스 츠누키", founded: 2016, blurb: "일본 최남단 증류소. 따뜻해서 숙성이 빨라요." },
  Akkeshi: { nameKo: "아케시", founded: 2016, blurb: "홋카이도 습지 옆. '일본의 아일라'를 목표로 해요." },
  Matsui: { nameKo: "마츠이", founded: 2017, blurb: "돗토리현의 작은 증류소. 병 디자인도 예뻐요." },
  Sakurao: { nameKo: "사쿠라오", founded: 2017, blurb: "히로시마 바닷가. 진으로 먼저 이름을 알렸어요." },
  "Chugoku Jozo": { nameKo: "추고쿠 양조 (토고우치)", founded: 1918, blurb: "터널에서 숙성하는 걸로 유명해요." },
  Warenghem: { nameKo: "바랑겜 (아르모릭)", founded: 1900, blurb: "브르타뉴 바닷가. 프랑스 싱글몰트의 대표 격이에요." },
  "Distillerie des Menhirs": { nameKo: "므니르 증류소 (에뒤)", founded: 1986, blurb: "보리가 아니라 **메밀**로 위스키를 만드는 드문 곳이에요." },
  "Grallet-Dupic": { nameKo: "그랄레-뒤픽 (로즐리외르)", founded: 1860, blurb: "로렌 지방의 농장형 증류소. 보리를 직접 길러요." },
  Brenne: { nameKo: "브렌", founded: 2012, blurb: "코냑 지방에서 만들어요. 바나나 향으로 화제가 됐어요." },
  "Domaine des Hautes Glaces": { nameKo: "오트 글라스", founded: 2009, blurb: "알프스 1,000m 고지의 유기농 증류소예요." },
  "Glann ar Mor": { nameKo: "글란 아르 모르 (코르노그)", founded: 2005, blurb: "브르타뉴 바닷가. '프랑스의 아일라'로 불려요." },
  "Michel Couvreur": { nameKo: "미셸 쿠브뢰르", founded: 1978, blurb: "스코틀랜드 원액을 부르고뉴 지하 저장고에서 재워요." },
  "Domaine Mavela": { nameKo: "도멘 마벨라 (P&M)", founded: 2000, blurb: "지중해 코르시카 섬. 허브 향이 독특해요." },
  "Moon Harbour": { nameKo: "문 하버", founded: 2017, blurb: "보르도 항구의 옛 연료 저장고를 고쳐 만들었어요." },
  "Distillerie Lehmann": { nameKo: "르망 증류소", founded: 1850, blurb: "알자스 와인 통을 쓰는 게 특징이에요." },
  "Distillerie du Vercors": { nameKo: "베르코르 증류소", founded: 2016, blurb: "베르코르 산지의 유기농 증류소. 맑은 스타일이에요." },
  Nantou: { nameKo: "난터우 (오마)", founded: 2008, blurb: "대만 공기업이 만드는 위스키. 열대 과일 향이 강해요." },
  Rampur: { nameKo: "람푸르", founded: 1943, blurb: "히말라야 기슭. 인도 위스키 중 가장 부드러운 축이에요." },
  "Milk & Honey": { nameKo: "밀크 앤 허니", founded: 2012, blurb: "텔아비브의 증류소. 더운 나라 위스키의 좋은 예예요." },
  Mackmyra: { nameKo: "막미라", founded: 1999, blurb: "스웨덴 참나무 통을 써요. 북유럽다운 나무 향이 나요." },
  Puni: { nameKo: "푸니", founded: 2010, blurb: "이탈리아 알프스의 유일한 위스키 증류소. 건물이 예뻐요." },
  Bimber: { nameKo: "빔버", founded: 2016, blurb: "런던 한복판의 소규모 증류소. 평이 아주 좋아요." },
  "Sullivans Cove": { nameKo: "설리번스 코브", founded: 1994, blurb: "세계 최고 싱글몰트로 뽑힌 적이 있는 호주 위스키." },
  Teerenpeli: { nameKo: "테렌펠리", founded: 2002, blurb: "핀란드의 증류소. 원래는 브루펍에서 시작했어요." },
  "Nc'nean": { nameKo: "느크니안", founded: 2017, blurb: "탄소 중립을 목표로 해요. 병도 재활용 유리로 만들어요." },
  Lochlea: { nameKo: "로클리", founded: 2018, blurb: "시인 로버트 번스가 살던 농장에 지은 증류소예요." },
  Glendullan: { nameKo: "글렌둘란", founded: 1897, blurb: "싱글톤 삼형제 중 하나. 부드럽고 달아요." },
  Glenglassaugh: { nameKo: "글렌글라사", founded: 1875, blurb: "해변 옆 증류소. 최근 평이 크게 좋아졌어요." },
  Annandale: { nameKo: "애넌데일", founded: 1836, blurb: "2014년에 되살아난 로우랜드 증류소. 고도수로 유명해요." },
  Holyrood: { nameKo: "홀리루드", founded: 2019, blurb: "에든버러 도심의 증류소. 여행 중 들르기 좋아요." },
  "Kim Chang Soo": { nameKo: "김창수 위스키", founded: 2020, blurb: "한 사람이 시작한 한국 증류소. 물량이 적어 추첨으로 팔아요." },
  Glentauchers: { nameKo: "글렌타우처스", founded: 1897, blurb: "발렌타인의 핵심 원액. 단독 병입은 드물어요." },
  Benrinnes: { nameKo: "벤리네스", founded: 1826, blurb: "부분 삼중 증류라는 독특한 방식으로 질감이 두꺼워요." },
  Dailuaine: { nameKo: "다일루안", founded: 1852, blurb: "조니워커의 숨은 원액. 진하고 묵직한 스타일." },
  Glenlossie: { nameKo: "글렌로시", founded: 1876, blurb: "헤이그 블렌드의 원액. 가볍고 꽃 향이 좋아요." },
  "Glen Spey": { nameKo: "글렌 스페이", founded: 1878, blurb: "J&B 블렌드의 원액. 조용하지만 잘 만든 스페이사이드." },
  Auchroisk: { nameKo: "오크로이스크", founded: 1974, blurb: "이름 읽기가 어려운 걸로 유명해요. 순한 셰리 스타일." },
  Strathmill: { nameKo: "스트라스밀", founded: 1891, blurb: "드라이하고 산뜻해요. 식전주로도 잘 어울려요." },
  Bladnoch: { nameKo: "블라드녹", founded: 1817, blurb: "스코틀랜드 최남단 증류소. 로우랜드 스타일의 좋은 예." },
  Daftmill: { nameKo: "다프트밀", founded: 2005, blurb: "농부가 농한기에만 만들어요. 물량이 적어 구하기 어려워요." },
  "Garrison Brothers": { nameKo: "개리슨 브라더스", founded: 2005, blurb: "텍사스 최초의 버번. 더위 덕에 숙성이 아주 빨라요." },
  "Hiram Walker": { nameKo: "하이럼 워커", founded: 1858, blurb: "캐나다 라이의 본거지. 랏40·와이저스를 만들어요." },

  // ── Scotland · Speyside ──
  Glenfiddich: { nameKo: "글렌피딕", founded: 1887, blurb: "더프타운의 사슴 로고. 세계에서 가장 많이 팔리는 싱글몰트를 만드는 가족 경영 증류소." },
  "William Grant & Sons": { nameKo: "윌리엄 그랜트 앤 선즈", founded: 1887, blurb: "글렌피딕·발베니를 소유한 가족 회사. 몽키 숄더 같은 블렌디드 몰트도 여기서." },
  "The Balvenie": { nameKo: "발베니", founded: 1892, blurb: "글렌피딕 바로 옆. 아직도 직접 보리를 띄우고 통을 만드는 '수작업' 증류소." },
  "The Glenlivet": { nameKo: "글렌리벳", founded: 1824, blurb: "합법 면허를 받은 첫 스페이사이드 증류소. 꽃과 과일 향의 교과서." },
  "The Macallan": { nameKo: "맥캘란", founded: 1824, blurb: "셰리 통 숙성의 상징. 2018년 지은 잔디 지붕 증류소가 유명해요." },
  Aberlour: { nameKo: "아벨라워", founded: 1879, blurb: "스페이 강가의 마을 증류소. 셰리 스타일과 아부나흐로 사랑받아요." },
  "Glen Grant": { nameKo: "글렌 그란트", founded: 1840, blurb: "로시스의 정원이 아름다운 증류소. 가볍고 깨끗한 스타일." },
  GlenAllachie: { nameKo: "글렌알라키", founded: 1967, blurb: "2017년 독립한 뒤 셰리 위스키로 세계 대회를 휩쓴 신흥 강자." },
  Tamdhu: { nameKo: "탐두", founded: 1897, blurb: "100% 셰리 통만 쓰는 증류소. 옛 기차역 건물이 방문객 센터예요." },
  Dufftown: { nameKo: "더프타운", founded: 1896, blurb: "싱글톤 브랜드로 나오는 대형 증류소. 부드럽고 무난한 입문용." },
  Cragganmore: { nameKo: "크래건모어", founded: 1869, blurb: "스페이사이드 최초로 철도 옆에 지은 증류소. 균형 좋은 클래식." },
  Glenfarclas: { nameKo: "글렌파클라스", founded: 1836, blurb: "그랜트 가족이 6대째 운영하는 독립 증류소. 착한 가격의 셰리 위스키." },
  Cardhu: { nameKo: "카듀", founded: 1824, blurb: "여성(헬렌 커밍)이 세운 최초의 증류소. 조니워커의 핵심 원액." },
  "Glen Moray": { nameKo: "글렌 모레이", founded: 1897, blurb: "엘긴의 가성비 증류소. 다양한 통 마무리 실험으로 유명." },
  Speyburn: { nameKo: "스페이번", founded: 1897, blurb: "로시스 계곡의 작은 증류소. 미국·한국에서 가성비로 인기." },
  Benromach: { nameKo: "벤로막", founded: 1898, blurb: "포레스의 작은 증류소. 1960년대 스타일을 재현해요." },
  Mortlach: { nameKo: "몰트락", founded: 1823, blurb: "더프타운 최초의 증류소. 2.81회 증류로 고기 같은 묵직함." },
  Tamnavulin: { nameKo: "탐나불린", founded: 1966, blurb: "'언덕 위 방앗간'. 가장 저렴한 싱글몰트 중 하나." },
  Strathisla: { nameKo: "스트라스아일라", founded: 1786, blurb: "스코틀랜드에서 가장 오래 운영 중인 증류소. 시바스 리갈의 고향." },
  Craigellachie: { nameKo: "크레이겔라키", founded: 1891, blurb: "스페이 강 다리 옆. 옛 방식(웜텁 냉각)으로 독특한 유황 향." },
  // ── Scotland · Highland ──
  Glenmorangie: { nameKo: "글렌모렌지", founded: 1843, blurb: "스코틀랜드에서 가장 키 큰 증류기. 섬세하고 통 실험을 즐기는 증류소." },
  Oban: { nameKo: "오반", founded: 1794, blurb: "항구 마을 한가운데 있는 작은 증류소. 바다와 은은한 연기." },
  GlenDronach: { nameKo: "글렌드로낙", founded: 1826, blurb: "셰리 위스키의 교과서. 올로로소·PX 통을 고집해요." },
  Ardmore: { nameKo: "아드모어", founded: 1898, blurb: "하이랜드에서 드물게 피트를 쓰는 증류소. 티처스 블렌디드의 심장." },
  Tomatin: { nameKo: "토마틴", founded: 1897, blurb: "인버네스 남쪽 고지대. 한때 스코틀랜드 최대 증류소였어요." },
  Pulteney: { nameKo: "풀트니", founded: 1826, blurb: "본토 최북단 항구 윅. 바다 향의 '해양 위스키'." },
  Clynelish: { nameKo: "클라이넬리시", founded: 1967, blurb: "브로라 옆. 밀랍 같은 질감(왁시)으로 애호가들이 사랑해요." },
  Dalwhinnie: { nameKo: "달위니", founded: 1897, blurb: "스코틀랜드에서 가장 높고 추운 증류소. 꿀처럼 부드러워요." },
  Aberfeldy: { nameKo: "애버펠디", founded: 1896, blurb: "듀어스 블렌디드의 고향. 꿀 향이 특징." },
  Deanston: { nameKo: "딘스톤", founded: 1965, blurb: "옛 방직 공장을 개조. 수력 발전으로 돌아가는 친환경 증류소." },
  "Loch Lomond": { nameKo: "로크 로몬드", founded: 1964, blurb: "호수 근처 대형 증류소. 한 곳에서 여러 스타일을 만들어요." },
  Glengoyne: { nameKo: "글렌고인", founded: 1833, blurb: "글래스고 북쪽. 연기를 전혀 쓰지 않고 가장 느리게 증류." },
  Edradour: { nameKo: "에드라두어", founded: 1825, blurb: "피틀로크리의 작은 증류소. 직원 몇 명이 만드는 셰리 위스키." },
  Fettercairn: { nameKo: "페터케언", founded: 1824, blurb: "증류기에 물을 흘려 식히는 독특한 방식. 열대과일 향." },
  "Glen Ord": { nameKo: "글렌 오드", founded: 1838, blurb: "블랙 아일의 증류소. 싱글톤 아시아 버전의 원액." },
  "Glen Garioch": { nameKo: "글렌 기리", founded: 1797, blurb: "올드멜드럼의 오래된 증류소. 진한 몰트 맛." },
  Ardnamurchan: { nameKo: "아드나머칸", founded: 2014, blurb: "본토 최서단 반도의 신생 증류소. 피트와 논피트를 반씩." },
  // ── Scotland · Islay ──
  Laphroaig: { nameKo: "라프로익", founded: 1815, blurb: "아일라 남쪽 해안. 소독약 같은 강렬한 연기로 호불호의 대명사." },
  Ardbeg: { nameKo: "아드벡", founded: 1815, blurb: "피트 끝판왕. 매년 6월 아드벡 데이에 전 세계 팬이 모여요." },
  Lagavulin: { nameKo: "라가불린", founded: 1816, blurb: "피트 위스키의 완성형. 16년이 아일라의 기준점." },
  Bowmore: { nameKo: "보모어", founded: 1779, blurb: "아일라에서 가장 오래된 증류소. 균형 잡힌 중간 피트." },
  Bunnahabhain: { nameKo: "부나하벤", founded: 1881, blurb: "아일라 북쪽 끝. 연기 없는 셰리 스타일로 예외적인 증류소." },
  "Caol Ila": { nameKo: "쿨일라", founded: 1846, blurb: "아일라 최대 증류소. 깨끗한 연기로 조니워커에도 들어가요." },
  Kilchoman: { nameKo: "킬호만", founded: 2005, blurb: "농장 증류소. 보리 재배부터 병입까지 섬 안에서." },
  Bruichladdich: { nameKo: "브룩라디", founded: 1881, blurb: "하늘색 병. 논피트(브룩라디)·피트(포트 샬롯)·초피트(옥토모어)를 모두." },
  // ── Scotland · Islands ──
  Talisker: { nameKo: "탈리스커", founded: 1830, blurb: "스카이 섬의 유일한 오래된 증류소. 후추 같은 바다 위스키." },
  "Highland Park": { nameKo: "하이랜드 파크", founded: 1798, blurb: "오크니 섬, 스코틀랜드 최북단. 헤더 피트와 셰리의 균형." },
  Arran: { nameKo: "아란", founded: 1995, blurb: "아란 섬의 젊은 증류소. 밝고 과일향." },
  Jura: { nameKo: "쥬라", founded: 1810, blurb: "인구 200명 섬의 유일한 증류소. 조지 오웰이 1984를 쓴 섬." },
  Scapa: { nameKo: "스카파", founded: 1885, blurb: "오크니의 조용한 증류소. 하이랜드 파크 옆인데 연기가 없어요." },
  Tobermory: { nameKo: "토버모리", founded: 1798, blurb: "멀 섬 알록달록한 항구. 논피트(토버모리)와 피트(레첵)를 함께." },
  Torabhaig: { nameKo: "토라베이그", founded: 2017, blurb: "스카이 섬 190년 만의 두 번째 증류소." },
  // ── Scotland · Lowland / Campbeltown ──
  Glenkinchie: { nameKo: "글렌킨치", founded: 1837, blurb: "에딘버러 근교. 가장 가볍고 꽃향기 나는 스타일." },
  Auchentoshan: { nameKo: "오큰토션", founded: 1823, blurb: "글래스고 근교. 스코틀랜드 유일의 3번 증류." },
  Kingsbarns: { nameKo: "킹스반스", founded: 2014, blurb: "세인트앤드루스 근처 신생 증류소. 과일향 로우랜드." },
  Springbank: { nameKo: "스프링뱅크", founded: 1828, blurb: "캠벨타운의 전설. 모든 공정을 한 곳에서 수작업으로." },
  Glengyle: { nameKo: "글렌가일", founded: 2004, blurb: "스프링뱅크가 부활시킨 자매 증류소. 킬커란 브랜드." },
  "Glen Scotia": { nameKo: "글렌 스코시아", founded: 1832, blurb: "캠벨타운에 남은 세 증류소 중 하나. 바다 향과 단맛." },
  // ── Ireland ──
  Midleton: { nameKo: "미들턴", founded: 1825, blurb: "코크 근처 거대 증류소. 제임슨·레드브레스트·스팟 시리즈의 고향." },
  Bushmills: { nameKo: "부시밀", founded: 1608, blurb: "북아일랜드 해안. 세계에서 가장 오래된 위스키 면허." },
  Tullamore: { nameKo: "털러모어", founded: 1829, blurb: "아일랜드 한가운데. 2014년 새 증류소로 부활." },
  Teeling: { nameKo: "틸링", founded: 2015, blurb: "더블린 시내에 125년 만에 생긴 증류소. 도시 관광 명소." },
  Cooley: { nameKo: "쿨리", founded: 1987, blurb: "아일랜드 위스키 부흥의 시작. 피트 아이리시 코네마라를 만들어요." },
  "Walsh Whiskey": { nameKo: "월시 위스키", founded: 1999, blurb: "'작가의 눈물' 브랜드. 팟 스틸과 몰트만 섞는 독특한 구성." },
  Dingle: { nameKo: "딩글", founded: 2012, blurb: "아일랜드 서남단 바닷가 마을의 크래프트 증류소." },
  // ── USA ──
  "Buffalo Trace": { nameKo: "버팔로 트레이스", founded: 1773, blurb: "켄터키 프랭크포트. 블랜튼·이글 레어·웰러까지 명품 버번의 산실." },
  "Jim Beam": { nameKo: "짐빔", founded: 1795, blurb: "세계 판매 1위 버번. 놉 크릭·부커스·베이즐 헤이든도 여기서." },
  "Maker's Mark": { nameKo: "메이커스 마크", founded: 1953, blurb: "빨간 밀랍 봉인. 호밀 대신 밀을 쓰는 부드러운 버번." },
  "Wild Turkey": { nameKo: "와일드 터키", founded: 1869, blurb: "켄터키 강 절벽 위. 러셀 부자가 만드는 진한 버번." },
  "Woodford Reserve": { nameKo: "우드포드 리저브", founded: 1812, blurb: "말 농장 지대의 석조 증류소. 켄터키 더비 공식 버번." },
  "Four Roses": { nameKo: "포 로지스", founded: 1888, blurb: "스페인풍 건물. 10가지 레시피를 섞는 독특한 방식." },
  "Heaven Hill": { nameKo: "헤븐 힐", founded: 1935, blurb: "가족 소유 최대 증류소. 에반 윌리엄스·엘라이자 크레이그·라세니." },
  Bulleit: { nameKo: "불렛", founded: 1987, blurb: "개척 시대 병 디자인. 호밀 비율 높은 매콤한 버번." },
  "Jack Daniel's": { nameKo: "잭 다니엘", founded: 1866, blurb: "테네시 린치버그. 단풍나무 숯 여과가 특징." },
  "Cascade Hollow": { nameKo: "캐스케이드 할로우", founded: 1870, blurb: "조지 디켈 테네시 위스키. 잭 다니엘의 라이벌." },
  "Uncle Nearest": { nameKo: "엉클 니어리스트", founded: 2017, blurb: "잭 다니엘의 스승 니어리스트 그린을 기리는 테네시 브랜드." },
  "Angel's Envy": { nameKo: "엔젤스 엔비", founded: 2013, blurb: "루이빌 시내. 포트 와인 통 마무리 버번의 선구자." },
  "Michter's": { nameKo: "믹터스", founded: 2015, blurb: "루이빌. 미국에서 가장 오래된 위스키 브랜드 이름을 잇는 증류소." },
  "Barton 1792": { nameKo: "바튼 1792", founded: 1879, blurb: "바즈타운의 오래된 증류소. 1792 버번." },
  "High West": { nameKo: "하이 웨스트", founded: 2006, blurb: "유타 스키 리조트의 증류소. 라이 위스키 블렌딩 장인." },
  WhistlePig: { nameKo: "휘슬피그", founded: 2007, blurb: "버몬트 농장. 프리미엄 라이 위스키의 대명사." },
  Balcones: { nameKo: "발코니스", founded: 2008, blurb: "텍사스 웨이코. 더위에서 빨리 숙성하는 크래프트 싱글몰트." },
  // ── Japan ──
  Suntory: { nameKo: "산토리", founded: 1923, blurb: "일본 위스키의 시작. 야마자키·하쿠슈·치타 원액으로 히비키를 만들어요." },
  Yamazaki: { nameKo: "야마자키", founded: 1923, blurb: "교토 근교, 일본 최초의 몰트 증류소. 미즈나라 통의 고향." },
  Hakushu: { nameKo: "하쿠슈", founded: 1973, blurb: "남알프스 숲속 증류소. 상쾌한 '숲의 위스키'." },
  Chita: { nameKo: "치타", founded: 1972, blurb: "나고야 근처 그레인 증류소. 히비키의 부드러움 담당." },
  Nikka: { nameKo: "니카", founded: 1934, blurb: "다케츠루 마사타카가 세운 회사. 요이치·미야기쿄 두 증류소." },
  Yoichi: { nameKo: "요이치", founded: 1934, blurb: "홋카이도 바닷가. 석탄 직화 증류로 스코틀랜드식 묵직함." },
  Miyagikyo: { nameKo: "미야기쿄", founded: 1969, blurb: "센다이 산속. 요이치와 대조되는 부드럽고 화사한 스타일." },
  Chichibu: { nameKo: "치치부", founded: 2008, blurb: "이치로 아쿠토의 크래프트 증류소. 일본 위스키 붐의 주역." },
  "Fuji Gotemba": { nameKo: "후지 고텐바", founded: 1973, blurb: "후지산 기슭 기린 증류소. 그레인 위스키로 세계 1위." },
  Eigashima: { nameKo: "에이가시마", founded: 1919, blurb: "일본에서 가장 오래된 위스키 면허. 아카시 브랜드." },
  "Mars Shinshu": { nameKo: "마르스 신슈", founded: 1985, blurb: "일본 최고 고도(798m) 증류소. 이와이 브랜드." },
  Kanosuke: { nameKo: "카노스케", founded: 2017, blurb: "가고시마 해변. 소주 통에서 숙성하는 신생 증류소." },
  // ── Korea ──
  "Three Societies": { nameKo: "쓰리소사이어티스", founded: 2020, blurb: "남양주. 한국 최초의 싱글몰트 '기원'을 만드는 증류소." },
  "Kim Chang Soo Distillery": { nameKo: "김창수 위스키 증류소", founded: 2020, blurb: "김포. 혼자 만드는 1인 증류소. 출시마다 오픈런." },
  // ── World ──
  Kavalan: { nameKo: "카발란", founded: 2005, blurb: "대만 이란현. 더운 기후로 빠르게 숙성해 세계 대회를 휩쓴 증류소." },
  Amrut: { nameKo: "암룻", founded: 1948, blurb: "인도 방갈로르. 인도 싱글몰트의 선구자." },
  "Paul John": { nameKo: "폴 존", founded: 2008, blurb: "인도 고아 해변. 열대과일 향의 싱글몰트." },
  Piccadily: { nameKo: "피카딜리", founded: 1953, blurb: "인도 북부. 인드리 브랜드로 2023년 세계 최고 위스키 상." },
  Penderyn: { nameKo: "펜더린", founded: 2000, blurb: "웨일스 유일의 위스키 증류소." },
  Cotswolds: { nameKo: "코츠월드", founded: 2014, blurb: "잉글랜드 전원 지대. 영국 잉글랜드 위스키의 대표." },
  Starward: { nameKo: "스타워드", founded: 2007, blurb: "멜버른 도심. 호주 레드와인 통에서 숙성." },
  "Crown Royal": { nameKo: "크라운 로얄", founded: 1939, blurb: "캐나다 매니토바. 보라색 주머니의 캐나다 위스키." },
  "Canadian Club": { nameKo: "캐나디안 클럽", founded: 1858, blurb: "온타리오 윈저. 금주법 시대 밀수로 유명해진 브랜드." },
};

export interface Distillery {
  name: string; // whiskies.ts 의 distillery 문자열
  meta: DistilleryMeta;
  country: string;
  region: Region;
  lat: number;
  lng: number;
  whiskies: Whisky[];
}

let cache: Distillery[] | null = null;

/** 좌표가 있는 증류소 목록. 같은 자리에 겹치는 곳은 살짝 비켜 놓아요. */
export function getDistilleries(): Distillery[] {
  if (cache) return cache;
  const map = new Map<string, Distillery>();
  for (const w of WHISKIES) {
    if (!w.location) continue;
    const existing = map.get(w.distillery);
    if (existing) {
      existing.whiskies.push(w);
      continue;
    }
    map.set(w.distillery, {
      name: w.distillery,
      meta: DISTILLERY_META[w.distillery] ?? { nameKo: w.distillery, founded: null, blurb: "" },
      country: w.country,
      region: w.region,
      lat: w.location.lat,
      lng: w.location.lng,
      whiskies: [w],
    });
  }
  // 거의 같은 자리(더프타운의 글렌피딕·발베니·몰트락 등)는 작은 원으로 벌려요.
  const list = [...map.values()];
  for (let i = 0; i < list.length; i++) {
    let bumps = 0;
    for (let j = 0; j < i; j++) {
      const dl = list[i].lat - list[j].lat;
      const dg = list[i].lng - list[j].lng;
      if (Math.hypot(dl, dg) < 0.03) bumps++;
    }
    if (bumps > 0) {
      const ang = bumps * 1.7;
      list[i].lat += Math.sin(ang) * 0.028 * bumps;
      list[i].lng += Math.cos(ang) * 0.04 * bumps;
    }
  }
  cache = list;
  return list;
}

export function getDistillery(name: string): Distillery | undefined {
  return getDistilleries().find((d) => d.name === name);
}
