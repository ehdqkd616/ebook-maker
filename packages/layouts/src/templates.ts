import type { Block, Book, BookType, SizePreset } from "@ebook/schema";
import { composeBook, newId, type ComposeChapter } from "./compose";
import { getThemePreset } from "./themes";

// 템플릿 — 바로 고쳐 쓸 수 있는 예시 책. 자동 조판(composeBook)으로 만든 뒤
// 책 성격에 맞는 인터랙티브 요소(상품 태그·연락처 받기·버튼 등)를 챕터 시작 쪽 아래에 얹는다.

export type TemplateDef = {
  id: string;
  name: string;
  description: string;
  category: "읽을거리" | "비즈니스" | "교육" | "행사·홍보";
  bookType: BookType;
  themeId: string;
  sizePreset: SizePreset;
  title: string;
  subtitle?: string;
  author?: string;
  chapters: ComposeChapter[];
  /** 챕터 번호 → 그 챕터 시작 쪽에 얹을 블록 (x·y·w·h는 쪽 크기에 대한 비율) */
  extras?: Record<number, ((W: number, H: number, chapterPage: (ci: number) => number) => Block)[]>;
  dropCap?: boolean;
  backCoverMessage?: string;
};

const at = (W: number, H: number, x: number, y: number, w: number, h: number) => ({ id: newId(), x: Math.round(W * x), y: Math.round(H * y), w: Math.round(W * w), h: Math.round(h) });

export const TEMPLATES: TemplateDef[] = [
  {
    id: "essay",
    name: "에세이",
    description: "명조체와 첫 글자 장식으로 차분하게 읽히는 산문집",
    category: "읽을거리",
    bookType: "ebook",
    themeId: "paper-serif",
    sizePreset: "A4",
    title: "느리게 걷는 하루",
    subtitle: "작은 동네에서 배운 것들",
    author: "지은이 이름",
    dropCap: true,
    chapters: [
      {
        title: "아침의 골목",
        summary: "누구보다 먼저 깨어나는 골목에서 하루를 시작합니다.",
        body: "아침 여섯 시, 골목은 빵 굽는 냄새로 먼저 깨어난다. 셔터를 올리는 소리, 자전거 바퀴가 돌길을 지나가는 소리가 차례로 하루를 연다.\n\n오래 살아온 동네인데도 이 시간의 골목은 매번 처음 보는 곳 같다. 같은 길을 같은 속도로 걷는데, 어제 보지 못한 것이 오늘은 눈에 들어온다.\n\n## 천천히 보는 연습\n\n빨리 걷던 시절에는 목적지만 보였다. 지금은 담장 아래 핀 들꽃, 창문에 걸린 화분, 인사하는 이웃의 얼굴이 먼저 보인다.",
      },
      {
        title: "오후의 책방",
        summary: "작은 책방에서 만난 사람들과 책 이야기.",
        body: "모퉁이 책방은 오후 두 시에 문을 연다. 주인은 손님이 고른 책마다 짧은 쪽지를 끼워 준다.\n\n> 좋은 책은 읽는 사람의 속도를 기다려 준다.\n\n그 쪽지들을 모아 두니 한 권의 작은 책이 되었다. 이 글은 그 쪽지에서 시작되었다.",
      },
      {
        title: "저녁의 식탁",
        summary: "하루를 정리하는 가장 따뜻한 시간.",
        body: "저녁은 늘 간단하다. 제철 채소 한 접시, 따뜻한 국 한 그릇. 그래도 식탁에 앉으면 하루가 조용히 정리된다.\n\n오늘 고마웠던 일 세 가지를 적는 습관은 이 식탁에서 생겼다.",
      },
    ],
    backCoverMessage: "읽어 주셔서 고맙습니다.",
  },
  {
    id: "catalog",
    name: "제품 카탈로그",
    description: "상품 태그를 누르면 가격·설명·구매 링크가 뜨는 카탈로그",
    category: "비즈니스",
    bookType: "catalog",
    themeId: "modern-black",
    sizePreset: "LANDSCAPE",
    title: "2026 가을 컬렉션",
    subtitle: "일상을 위한 리빙 아이템",
    author: "브랜드 이름",
    chapters: [
      { title: "새로 나온 제품", summary: "이번 시즌 처음 선보이는 제품들입니다.", body: "## 세라믹 머그\n\n손으로 빚어 하나하나 모양이 조금씩 다릅니다. 전자레인지·식기세척기 사용 가능.\n\n## 리넨 테이블 매트\n\n물빨래해도 형태가 유지되는 워싱 리넨. 네 가지 색." },
      { title: "베스트셀러", summary: "많은 분이 다시 찾은 제품입니다.", body: "## 원목 트레이\n\n호두나무 원목에 식물성 오일로 마감했습니다.\n\n## 소이 캔들\n\n100% 소이 왁스, 약 40시간 연소." },
    ],
    extras: {
      0: [
        (W, H) => ({ ...at(W, H, 0.12, 0.82, 0, 44), w: 44, type: "product", data: { name: "세라믹 머그", price: "28,000원", description: "손으로 빚은 350ml 머그", href: "https://", buttonText: "구매하기" } }),
        (W, H) => ({ ...at(W, H, 0.2, 0.82, 0, 44), w: 44, type: "product", data: { name: "리넨 테이블 매트", price: "19,000원", description: "워싱 리넨 · 4색", href: "https://", buttonText: "구매하기" } }),
      ],
      1: [(W, H) => ({ ...at(W, H, 0.12, 0.82, 0.3, 54), type: "button", data: { text: "온라인 스토어 가기", variant: "pill" }, action: { type: "url", href: "https://" } })],
    },
  },
  {
    id: "company",
    name: "회사 소개서",
    description: "서비스 소개와 상담 신청 폼이 들어간 브로슈어",
    category: "비즈니스",
    bookType: "brochure",
    themeId: "classic-navy",
    sizePreset: "A4",
    title: "우리 회사를 소개합니다",
    subtitle: "고객의 일을 더 쉽게 만드는 팀",
    author: "회사 이름",
    chapters: [
      { title: "우리는", summary: "2018년에 시작해 300곳이 넘는 고객과 함께했습니다.", body: "우리는 작은 팀이 큰 일을 해낼 수 있도록 돕는 도구를 만듭니다.\n\n- 고객 만족도 98%\n- 평균 도입 기간 2주\n- 전담 매니저 배정" },
      { title: "서비스", summary: "필요한 만큼 골라 쓰는 세 가지 상품.", body: "## 스타터\n\n처음 시작하는 팀을 위한 기본 기능.\n\n## 비즈니스\n\n협업·권한 관리·보고서까지.\n\n## 엔터프라이즈\n\n보안 요구 사항과 맞춤 연동을 지원합니다." },
      { title: "함께 시작해요", summary: "아래 버튼을 눌러 상담을 신청하세요. 하루 안에 연락드립니다.", body: "궁금한 점이 있으면 언제든 연락 주세요.\n\n- 이메일: hello@example.com\n- 전화: 02-000-0000" },
    ],
    extras: {
      2: [
        (W, H) => ({
          ...at(W, H, 0.12, 0.82, 0.36, 58),
          type: "form",
          data: { text: "상담 신청하기", title: "상담 신청", description: "연락처를 남겨 주시면 하루 안에 연락드릴게요.", fields: ["name", "email", "phone"], submitText: "신청하기", successText: "신청을 받았어요. 곧 연락드릴게요!" },
        }),
      ],
    },
  },
  {
    id: "workbook",
    name: "수업 교재",
    description: "학습 목표·개념·연습 문제 순서로 짠 워크북",
    category: "교육",
    bookType: "textbook",
    themeId: "forest",
    sizePreset: "A4",
    title: "중학 과학 개념 노트",
    subtitle: "물질의 상태 변화",
    author: "과학 선생님",
    chapters: [
      { title: "학습 목표", summary: "이 단원을 마치면 할 수 있는 것.", body: "1. 물질의 세 가지 상태를 설명할 수 있다.\n2. 상태 변화와 열의 출입을 연결할 수 있다.\n3. 생활 속 상태 변화의 예를 찾을 수 있다." },
      { title: "핵심 개념", summary: "고체·액체·기체와 그 사이의 변화.", body: "## 세 가지 상태\n\n고체는 모양과 부피가 일정하고, 액체는 부피만 일정하며, 기체는 모양과 부피가 모두 일정하지 않다.\n\n> 상태가 변해도 물질의 종류는 바뀌지 않는다.\n\n## 열의 출입\n\n융해·기화·승화(고체→기체)는 열을 흡수하고, 응고·액화·승화(기체→고체)는 열을 방출한다." },
      { title: "연습 문제", summary: "스스로 풀어 보고 다음 쪽에서 확인하세요.", body: "1. 얼음이 녹아 물이 되는 변화의 이름은?\n2. 겨울철 유리창에 성에가 생기는 까닭을 설명해 보자.\n3. 젖은 빨래가 마르는 것은 어떤 상태 변화인가?" },
      { title: "정답과 풀이", body: "1. 융해 — 열을 흡수한다.\n2. 수증기가 차가운 유리에 닿아 바로 얼음이 된다(승화).\n3. 기화(증발) — 물이 수증기가 된다." },
    ],
    extras: {
      2: [(W, H, chapterPage) => ({ ...at(W, H, 0.12, 0.82, 0.3, 52), type: "button", data: { text: "정답 바로 보기", variant: "outline" }, action: { type: "page", page: chapterPage(3) } })],
    },
  },
  {
    id: "event",
    name: "행사 안내",
    description: "일정·연사·오시는 길과 참가 신청 폼",
    category: "행사·홍보",
    bookType: "brochure",
    themeId: "lavender",
    sizePreset: "SQUARE",
    title: "디자인 컨퍼런스 2026",
    subtitle: "11월 21일(토) · 서울",
    author: "주최 기관",
    chapters: [
      { title: "행사 소개", summary: "하루 동안 열리는 디자이너들의 축제.", body: "올해 주제는 '함께 만드는 디자인'입니다. 열두 명의 연사와 여섯 개의 워크숍이 준비되어 있어요." },
      { title: "프로그램", summary: "오전 10시부터 오후 6시까지.", body: "- 10:00 등록\n- 10:30 기조연설\n- 13:00 점심\n- 14:00 워크숍\n- 17:00 네트워킹" },
      { title: "오시는 길", summary: "지하철 2호선 OO역 3번 출구 도보 5분.", body: "주차 공간이 부족하니 대중교통을 이용해 주세요." },
    ],
    extras: {
      0: [
        (W, H) => ({
          ...at(W, H, 0.12, 0.8, 0.4, 60),
          type: "form",
          data: { text: "참가 신청", title: "참가 신청", description: "자리가 한정되어 있어요. 확정 안내를 이메일로 보내 드립니다.", fields: ["name", "email"], submitText: "신청하기", successText: "신청 완료! 확정 메일을 보내 드릴게요." },
        }),
      ],
      2: [(W, H) => ({ ...at(W, H, 0.12, 0.8, 0.36, 54), type: "button", data: { text: "지도에서 보기", variant: "solid" }, action: { type: "url", href: "https://map.naver.com" } })],
    },
  },
  {
    id: "recipe",
    name: "레시피북",
    description: "재료와 만드는 법을 목록으로 정리한 요리책",
    category: "읽을거리",
    bookType: "ebook",
    themeId: "sunset",
    sizePreset: "LETTER",
    title: "주말 브런치 레시피",
    subtitle: "30분이면 완성하는 열 가지 메뉴",
    author: "요리하는 사람",
    chapters: [
      { title: "프렌치 토스트", summary: "부드러운 브리오슈로 만드는 기본 브런치.", body: "## 재료 (2인분)\n\n- 브리오슈 4조각\n- 달걀 2개\n- 우유 120ml\n- 버터·메이플 시럽 조금\n\n## 만드는 법\n\n1. 달걀과 우유를 잘 섞는다.\n2. 빵을 앞뒤로 충분히 적신다.\n3. 버터를 녹인 팬에 중약불로 굽는다." },
      { title: "아보카도 토스트", summary: "5분 만에 만드는 든든한 한 접시.", body: "## 재료\n\n- 식빵 2장\n- 잘 익은 아보카도 1개\n- 레몬즙·소금·후추\n\n## 만드는 법\n\n1. 빵을 바삭하게 굽는다.\n2. 아보카도를 으깨 레몬즙과 소금으로 간한다.\n3. 빵에 듬뿍 올리고 후추를 뿌린다." },
    ],
  },
  {
    id: "portfolio",
    name: "포트폴리오",
    description: "작업 소개와 연락 버튼이 있는 가로형 포트폴리오",
    category: "비즈니스",
    bookType: "catalog",
    themeId: "minimal-gray",
    sizePreset: "LANDSCAPE",
    title: "포트폴리오 2026",
    subtitle: "브랜드·편집 디자인",
    author: "디자이너 이름",
    chapters: [
      { title: "소개", summary: "10년째 브랜드와 책을 디자인하고 있습니다.", body: "사람들이 오래 곁에 두는 물건을 만드는 일을 좋아합니다.\n\n- 브랜드 아이덴티티\n- 편집·출판 디자인\n- 패키지 디자인" },
      { title: "작업 1 — 동네 빵집 브랜딩", summary: "로고·패키지·간판까지 한 번에.", body: "오래된 빵집의 따뜻함을 살리면서 새로운 손님도 찾아오게 만드는 것이 목표였습니다." },
      { title: "작업 2 — 여행 매거진", summary: "계절마다 나오는 120쪽 잡지.", body: "사진이 숨 쉴 수 있도록 여백을 넉넉히 두고, 글은 두 단으로 짰습니다." },
    ],
    extras: {
      0: [(W, H) => ({ ...at(W, H, 0.12, 0.8, 0.26, 54), type: "button", data: { text: "이메일 보내기", variant: "solid" }, action: { type: "url", href: "mailto:hello@example.com" } })],
    },
  },
];

export const getTemplate = (id: string) => TEMPLATES.find((t) => t.id === id);

/** 템플릿으로 새 책을 만든다 */
export function bookFromTemplate(t: TemplateDef): Book {
  const book = composeBook({
    id: "new",
    title: t.title,
    subtitle: t.subtitle,
    author: t.author,
    bookType: t.bookType,
    sizePreset: t.sizePreset,
    theme: getThemePreset(t.themeId).theme,
    chapters: t.chapters,
    includeToc: t.chapters.length > 2,
    includeBackCover: true,
    backCoverMessage: t.backCoverMessage,
  });
  const { width: W, height: H } = book.size;
  const chapterIds = book.outline.chapters.map((c) => c.id);
  const firstBody = new Set<string>();
  const chapterPage = (ci: number) => book.pages.findIndex((p) => p.chapterId === chapterIds[ci] && p.layoutId === "chapter-opener") + 1 || 1;
  const pages = book.pages.map((p) => {
    let blocks = p.blocks;
    const ci = p.chapterId ? chapterIds.indexOf(p.chapterId) : -1;
    if (ci >= 0 && p.layoutId === "chapter-opener" && t.extras?.[ci]) blocks = [...blocks, ...t.extras[ci].map((f) => f(W, H, chapterPage))];
    // 챕터 첫 본문 쪽의 첫 문단에 첫 글자 장식
    if (t.dropCap && p.chapterId && p.layoutId !== "chapter-opener" && !firstBody.has(p.chapterId)) {
      firstBody.add(p.chapterId);
      let done = false;
      blocks = blocks.map((b) => {
        if (done || b.type !== "paragraph") return b;
        done = true;
        return { ...b, data: { ...b.data, dropCap: true } };
      });
    }
    return blocks === p.blocks ? p : { ...p, blocks };
  });
  return { ...book, pages };
}
