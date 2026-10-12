import { BookCover } from "@/components/BookCover";
import { sampleBook } from "@/lib/sample-book";

/** 로그인·가입 화면: 왼쪽 소개 패널 + 오른쪽 양식 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2">
      <div className="relative hidden h-full max-h-[640px] overflow-hidden rounded-[28px] bg-ink p-10 text-white lg:flex lg:flex-col">
        <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-brand-500/50 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-20 size-80 rounded-full bg-fuchsia-500/30 blur-3xl" />
        <p className="relative eyebrow text-brand-300">Ebook Maker</p>
        <p className="relative mt-3 text-[32px] leading-tight font-bold tracking-tight">
          원고와 PDF를<br />넘겨 보는 책으로.
        </p>
        <p className="relative mt-3 max-w-sm text-white/65">표지·목차·본문을 자동으로 짜고, 웹에서 다듬어 플립북 링크로 공유하세요.</p>
        <div className="relative mt-auto flex items-end gap-5 pt-10 [perspective:1200px]">
          <BookCover book={sampleBook} width={150} className="[transform:rotateY(18deg)_rotateZ(-4deg)]" />
          <BookCover book={{ ...sampleBook, theme: { ...sampleBook.theme, primary: "#d1495b", secondary: "#edae49", background: "#fffaf5" } }} width={120} className="[transform:rotateY(18deg)_rotateZ(3deg)] opacity-90" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-md">{children}</div>
    </div>
  );
}
