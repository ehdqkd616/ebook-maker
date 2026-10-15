import { z } from "zod";

// SPEC 6.1 — 에디터·뷰어·PDF·EPUB이 모두 이 Book 문서 하나를 읽어서 렌더링한다.

export const BOOK_TYPES = ["ebook", "guidebook", "textbook", "brochure", "catalog"] as const;
export const BookType = z.enum(BOOK_TYPES);
export type BookType = z.infer<typeof BookType>;

// 크기 프리셋 (px). A4는 FlipHTML5와 같은 794×1123.
export const SIZE_PRESETS = {
  A4: { width: 794, height: 1123 },
  LETTER: { width: 816, height: 1056 },
  SQUARE: { width: 793, height: 793 },
  LANDSCAPE: { width: 1123, height: 794 },
} as const;
export type SizePreset = keyof typeof SIZE_PRESETS;

// CUSTOM: PDF를 그대로 가져올 때처럼 원본 비율을 지키는 크기
export const BookSize = z.object({
  preset: z.enum([...(Object.keys(SIZE_PRESETS) as [SizePreset, ...SizePreset[]]), "CUSTOM"]),
  width: z.number().min(200).max(3000),
  height: z.number().min(200).max(3000),
});
export type BookSize = z.infer<typeof BookSize>;

const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "hex color");

export const Theme = z.object({
  templateId: z.string(),
  primary: color,
  secondary: color,
  background: color,
  text: color,
  headingFont: z.string(),
  bodyFont: z.string(),
});
export type Theme = z.infer<typeof Theme>;

export const Chapter = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  content: z.string().optional(), // 본문 생성 후 채워짐 (Markdown)
});
export type Chapter = z.infer<typeof Chapter>;

export const Outline = z.object({ chapters: z.array(Chapter) });
export type Outline = z.infer<typeof Outline>;

export const LAYOUT_IDS = [
  "cover",
  "toc",
  "chapter-opener",
  "text-1col",
  "text-2col",
  "text-image-right",
  "text-image-left",
  "image-full-caption",
  "quote",
  "back-cover",
  "blank", // 슬롯·장식 없는 빈 페이지 (PDF 페이지 이미지 등)
] as const;
export const LayoutId = z.enum(LAYOUT_IDS);
export type LayoutId = z.infer<typeof LayoutId>;

// 블록을 눌렀을 때 — 외부 링크, 책 안 다른 쪽으로 이동, 팝업(글·이미지·동영상)
export const BlockAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), href: z.string().max(2000) }),
  z.object({ type: z.literal("page"), page: z.number().int().positive() }),
  z.object({
    type: z.literal("popup"),
    title: z.string().max(200).optional(),
    text: z.string().max(5000).optional(),
    image: z.string().max(2000).optional(),
    images: z.array(z.string().max(2000)).max(30).optional(), // 여러 장이면 넘겨 보기
    video: z.string().max(2000).optional(),
    allowSave: z.boolean().optional(), // 그림 저장 버튼 (활동지 등)
  }),
]);
export type BlockAction = z.infer<typeof BlockAction>;

export const ANIMATIONS = ["fade", "slide-up", "slide-left", "slide-right", "zoom", "bounce"] as const;
export const BlockAnimation = z.object({
  type: z.enum(ANIMATIONS),
  delay: z.number().min(0).max(10_000).default(0), // ms
  duration: z.number().min(100).max(5000).default(600),
});
export type BlockAnimation = z.infer<typeof BlockAnimation>;

const blockBase = {
  id: z.string(),
  action: BlockAction.optional(),
  animation: BlockAnimation.optional(),
  locked: z.boolean().optional(), // 에디터에서 선택·이동 막기
  hidden: z.boolean().optional(),
  slot: z.string().optional(), // 레이아웃 슬롯 이름 (자동 배치 시)
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
  rotation: z.number().optional(),
  style: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
};

export const LEAD_FIELDS = ["name", "email", "phone", "message"] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];
export const LEAD_FIELD_LABEL: Record<LeadField, string> = { name: "이름", email: "이메일", phone: "전화번호", message: "남길 말" };

// 연습 플레이어: 트랙(노래·반주·성부…)을 바꿔 듣고, 절·구간 버튼으로 원하는 곳부터 재생한다 (음악 교과서 악보 영상)
export const PlayerSection = z.object({ label: z.string().max(40).optional(), time: z.number().min(0) });
export const PlayerVerse = z.object({ label: z.string().max(40).optional(), sections: z.array(PlayerSection).max(60) });
export const ICONS = ["music", "play", "video", "headphones", "activity", "book", "pencil", "link", "info", "question", "check", "star", "image", "download", "mic", "file"] as const;
export type IconName = (typeof ICONS)[number];

export const Block = z.discriminatedUnion("type", [
  z.object({ ...blockBase, type: z.literal("heading"), data: z.object({ text: z.string(), level: z.number().int().min(1).max(3) }) }),
  // dropCap: 첫 글자를 크게 (책 본문 첫 문단 장식)
  z.object({ ...blockBase, type: z.literal("paragraph"), data: z.object({ text: z.string(), dropCap: z.boolean().optional() }) }),
  z.object({ ...blockBase, type: z.literal("list"), data: z.object({ items: z.array(z.string()), ordered: z.boolean().default(false) }) }),
  z.object({ ...blockBase, type: z.literal("quote"), data: z.object({ text: z.string(), cite: z.string().optional() }) }),
  z.object({ ...blockBase, type: z.literal("image"), data: z.object({ src: z.string(), alt: z.string().default(""), fit: z.enum(["cover", "contain"]).default("cover") }) }),
  z.object({ ...blockBase, type: z.literal("shape"), data: z.object({ kind: z.enum(["rect", "ellipse", "line"]), fill: z.string().optional() }) }),
  z.object({ ...blockBase, type: z.literal("audio"), data: z.object({ src: z.string(), title: z.string().optional() }) }),
  // src: 올린 파일(/api/files/…) 또는 YouTube·Vimeo 주소
  z.object({
    ...blockBase,
    type: z.literal("video"),
    data: z.object({ src: z.string(), autoplay: z.boolean().optional(), loop: z.boolean().optional(), muted: z.boolean().optional() }),
  }),
  z.object({
    ...blockBase,
    type: z.literal("slideshow"),
    data: z.object({
      images: z.array(z.object({ src: z.string(), caption: z.string().optional() })).max(30),
      fit: z.enum(["cover", "contain"]).default("cover"),
      autoplay: z.number().min(0).max(60).default(0), // 초, 0이면 수동
    }),
  }),
  // 상품 태그: 페이지 위 동그란 표시를 누르면 상품 카드가 뜬다 (카탈로그)
  z.object({
    ...blockBase,
    type: z.literal("product"),
    data: z.object({
      name: z.string().max(200),
      price: z.string().max(50).optional(),
      description: z.string().max(2000).optional(),
      image: z.string().optional(),
      href: z.string().max(2000).optional(),
      buttonText: z.string().max(40).optional(),
    }),
  }),
  z.object({ ...blockBase, type: z.literal("button"), data: z.object({ text: z.string().max(80), variant: z.enum(["solid", "outline", "pill"]).default("solid") }) }),
  // 투명한 클릭 영역 — PDF 페이지 위에 링크·팝업을 얹을 때
  z.object({ ...blockBase, type: z.literal("hotspot"), data: z.object({ label: z.string().max(80).optional(), pulse: z.boolean().default(false) }) }),
  // 외부 웹 콘텐츠(iframe). https 주소만
  z.object({ ...blockBase, type: z.literal("embed"), data: z.object({ url: z.string().max(2000) }) }),
  z.object({ ...blockBase, type: z.literal("link"), data: z.object({ text: z.string(), href: z.string() }) }),
  z.object({
    ...blockBase,
    type: z.literal("player"),
    data: z.object({
      title: z.string().max(120).optional(),
      tracks: z.array(z.object({ label: z.string().max(30), src: z.string().max(2000) })).min(1).max(20),
      verses: z.array(PlayerVerse).max(20).default([]),
      icon: z.enum(ICONS).default("music"),
    }),
  }),
  // 활동 아이콘: 쪽 위 작은 동그란 아이콘 — 눌렀을 때 동작(팝업·링크·쪽 이동)을 붙여 쓴다
  z.object({
    ...blockBase,
    type: z.literal("icon"),
    data: z.object({ icon: z.enum(ICONS), color: z.string().max(40).optional(), label: z.string().max(40).optional() }),
  }),
  // 연락처 받기: 누르면 이름·이메일 등을 입력하는 창이 뜨고, 보낸 내용은 책 주인의 통계 화면에 모인다
  z.object({
    ...blockBase,
    type: z.literal("form"),
    data: z.object({
      text: z.string().max(80), // 버튼 글자
      title: z.string().max(120),
      description: z.string().max(1000).optional(),
      fields: z.array(z.enum(LEAD_FIELDS)).min(1).max(4),
      submitText: z.string().max(40).optional(),
      successText: z.string().max(300).optional(),
    }),
  }),
  // 목차: 챕터 시작 페이지에서 자동으로 채운다 (refreshToc)
  z.object({
    ...blockBase,
    type: z.literal("toc"),
    data: z.object({ entries: z.array(z.object({ title: z.string(), page: z.number().int().positive() })) }),
  }),
]);
export type Block = z.infer<typeof Block>;
export type BlockType = Block["type"];

export const Page = z.object({
  id: z.string(),
  layoutId: LayoutId,
  chapterId: z.string().optional(),
  background: z.object({ color: z.string().optional(), imageUrl: z.string().optional() }).optional(),
  blocks: z.array(Block),
  /** 검색용 글 (PDF에서 가져온 페이지처럼 블록에 글이 없을 때) */
  searchText: z.string().max(20_000).optional(),
});
export type Page = z.infer<typeof Page>;

// 뷰어(플립북) 설정 — 넘김 방식, 배경, 로고, 도구 막대 버튼, 소리, 자동 넘김, 다운로드 허용
export const VIEWER_MODES = ["flip", "slide", "scroll"] as const;
export const ViewerSettings = z.object({
  mode: z.enum(VIEWER_MODES).default("flip"),
  background: z.string().max(40).optional(),
  backgroundImage: z.string().max(2000).optional(),
  logo: z.string().max(2000).optional(),
  logoHref: z.string().max(2000).optional(),
  flipSound: z.boolean().default(true),
  music: z.string().max(2000).optional(), // 배경 음악 (올린 오디오)
  autoplaySeconds: z.number().int().min(0).max(120).default(0),
  allowDownload: z.boolean().default(false), // 공개본에서 PDF 저장·인쇄 허용
  showPageNumbers: z.boolean().default(true),
  buttons: z
    .object({
      thumbnails: z.boolean().default(true),
      toc: z.boolean().default(true),
      search: z.boolean().default(true),
      zoom: z.boolean().default(true),
      share: z.boolean().default(true),
      fullscreen: z.boolean().default(true),
      bookmarks: z.boolean().default(true),
      autoplay: z.boolean().default(true),
      sound: z.boolean().default(true),
      reader: z.boolean().default(true), // 텍스트로 읽기
    })
    .prefault({}),
});
export type ViewerSettings = z.infer<typeof ViewerSettings>;
export const DEFAULT_VIEWER: ViewerSettings = ViewerSettings.parse({});

export const TocEntry = z.object({ title: z.string().max(300), page: z.number().int().positive(), level: z.number().int().min(1).max(4).default(1) });
export type TocEntry = z.infer<typeof TocEntry>;

export const Book = z.object({
  id: z.string(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  language: z.string(),
  bookType: BookType,
  size: BookSize,
  theme: Theme,
  outline: Outline,
  pages: z.array(Page),
  viewer: ViewerSettings.optional(),
  /** 목차를 직접 정한 경우 (PDF 책갈피 등). 없으면 챕터 시작 페이지로 만든다 */
  toc: z.array(TocEntry).max(500).optional(),
  meta: z.object({
    audience: z.string().optional(),
    style: z.string().optional(),
    tone: z.string().optional(),
    targetPages: z.number().int().positive().optional(),
  }),
});
export type Book = z.infer<typeof Book>;
