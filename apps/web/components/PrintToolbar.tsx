"use client";

export function PrintToolbar({ title, backHref, pages }: { title: string; backHref: string; pages: number }) {
  return (
    <div className="print-toolbar sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 text-sm">
      <a href={backHref} className="btn">← 편집으로</a>
      <span className="min-w-0 truncate font-medium">{title}</span>
      <span className="muted">{pages}쪽</span>
      <span className="muted ml-auto hidden md:inline">인쇄 창에서 대상을 <b>PDF로 저장</b>, 여백 <b>없음</b>, <b>배경 그래픽</b>을 켜 주세요.</span>
      <button type="button" className="btn-primary py-1.5 text-sm" onClick={() => window.print()}>인쇄 / PDF 저장</button>
    </div>
  );
}
