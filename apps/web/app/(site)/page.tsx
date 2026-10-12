import Link from "next/link";
import { getCurrentUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-24">
        <h1 className="text-4xl font-bold tracking-tight">주제 한 줄로 만드는 AI 전자책</h1>
        <p className="text-lg text-neutral-600">
          주제나 PDF/Word 파일을 넣으면 AI가 목차를 짜고, 디자인된 전자책을 만들어 책장 넘기는 플립북으로 공유합니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary">회원가입</Link>
          <Link href="/login" className="btn px-4 py-2.5 text-base">로그인</Link>
          <Link href="/b/sample" className="btn px-4 py-2.5 text-base">샘플 플립북 보기</Link>
        </div>
        <p className="text-sm text-neutral-500">가입 후 관리자 승인이 끝나면 이용할 수 있어요.</p>
      </div>
    );
  }

  const store = getStore();
  const books = store.all<{ id: string; title: string; status: string; updated_at: number }>(
    "SELECT id, title, status, updated_at FROM books WHERE user_id = ? ORDER BY updated_at DESC",
    user.id,
  );
  const credits = store.creditBalance(user.id);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">내 책</h1>
          <p className="muted mt-1 text-sm">보유 크레딧 {credits.toLocaleString()}</p>
        </div>
        <span className="btn-primary pointer-events-none opacity-50" title="2주차에 구현 예정">새 책 만들기 (준비 중)</span>
      </div>

      {books.length === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <p>아직 만든 책이 없어요.</p>
          <Link href="/b/sample" className="btn">샘플 플립북 보기</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <li key={b.id} className="card">
              <p className="font-semibold">{b.title}</p>
              <p className="muted mt-1 text-sm">{b.status} · {fmtDate(b.updated_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
