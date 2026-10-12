import type { BookType, Theme } from "@ebook/schema";

// 테마 프리셋 = 색 + 글꼴 묶음. 책 종류마다 어울리는 기본값을 하나씩 정해 둔다.
// 글꼴은 apps/web 루트 레이아웃에서 웹폰트로 불러온다.

export const FONTS = {
  sans: { label: "고딕 (Pretendard)", css: "'Pretendard Variable', Pretendard, 'Noto Sans KR', sans-serif" },
  serif: { label: "명조 (Noto Serif KR)", css: "'Noto Serif KR', 'Nanum Myeongjo', serif" },
  round: { label: "둥근 고딕 (Gowun Dodum)", css: "'Gowun Dodum', 'Pretendard Variable', sans-serif" },
} as const;
export type FontKey = keyof typeof FONTS;

export type ThemePreset = { id: string; name: string; theme: Theme };

const preset = (
  id: string,
  name: string,
  colors: Pick<Theme, "primary" | "secondary" | "background" | "text">,
  heading: FontKey = "sans",
  body: FontKey = "sans",
): ThemePreset => ({
  id,
  name,
  theme: { templateId: id, ...colors, headingFont: FONTS[heading].css, bodyFont: FONTS[body].css },
});

export const THEME_PRESETS: ThemePreset[] = [
  preset("classic-navy", "클래식 네이비", { primary: "#2f4b8f", secondary: "#f2b134", background: "#fffdf8", text: "#1f2430" }),
  preset("modern-black", "모던 블랙", { primary: "#111111", secondary: "#e4572e", background: "#ffffff", text: "#1a1a1a" }),
  preset("forest", "포레스트", { primary: "#2d6a4f", secondary: "#b7e4c7", background: "#fbfdf9", text: "#1b2b22" }, "serif", "sans"),
  preset("sunset", "선셋", { primary: "#d1495b", secondary: "#edae49", background: "#fffaf5", text: "#2e1f1f" }),
  preset("lavender", "라벤더", { primary: "#6c5ce7", secondary: "#fd79a8", background: "#fcfbff", text: "#25213b" }, "round", "round"),
  preset("paper-serif", "페이퍼 명조", { primary: "#7a5c3e", secondary: "#c9a227", background: "#fbf7ef", text: "#2b2118" }, "serif", "serif"),
  preset("ocean", "오션", { primary: "#0077b6", secondary: "#90e0ef", background: "#f8fcff", text: "#14213d" }),
  preset("minimal-gray", "미니멀 그레이", { primary: "#4a4e57", secondary: "#a3a9b4", background: "#ffffff", text: "#22252b" }),
];

export function getThemePreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

export const BOOK_TYPE_INFO: Record<BookType, { label: string; description: string; theme: string }> = {
  ebook: { label: "전자책", description: "에세이·소설·자기계발 등 읽는 책", theme: "classic-navy" },
  guidebook: { label: "가이드북", description: "사용 설명서·여행·업무 매뉴얼", theme: "ocean" },
  textbook: { label: "교재", description: "수업 자료·학습서·워크북", theme: "forest" },
  brochure: { label: "브로슈어", description: "회사·행사·서비스 소개", theme: "sunset" },
  catalog: { label: "카탈로그", description: "상품·작품·포트폴리오 모음", theme: "modern-black" },
};
