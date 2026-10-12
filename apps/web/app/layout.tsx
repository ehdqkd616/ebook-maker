import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ebook Maker",
  description: "글을 넣으면 디자인된 전자책으로 만들어 플립북으로 공유하세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard (OFL) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 책 테마용 명조·둥근 고딕 (OFL) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Noto+Serif+KR:wght@400;600;700&display=swap"
        />
      </head>
      <body className="bg-neutral-100 text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
