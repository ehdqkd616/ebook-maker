import Link from "next/link";
import { BookCardActions } from "@/components/BookCardActions";
import { PageThumb } from "@/components/PageThumb";
import { getCurrentUser } from "@/lib/server/auth";
import { listBooks } from "@/lib/server/books";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["글만 넣으면 자동 조판", "표지·목차·챕터·본문 페이지를 규칙에 맞춰 짜고, 넘치는 글은 다음 쪽으로 넘겨요."],
  ["페이지 에디터", "글·이미지·도형을 끌어서 옮기고, 레이아웃과 테마를 클릭 한 번에 바꿔요."],
  ["플립북으로 공유", "책장 넘기는 뷰어 주소·QR·임베드 코드로 공유하고, PDF로도 저장해요."],
] as const;

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-24">
        <div className="flex flex-col gap-6">
          <h1 className="text-4xl font-bold tracking-tight">글만 있으면, 책이 됩니다</h1>
          <p className="text-lg text-neutral-600">
            원고를 붙여 넣으면 디자인된 전자책으로 자동 조판하고, 웹 에디터에서 다듬어 책장 넘기는 플립북으로 공유하세요.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary">회원가입</Link>
            <Link href="/login" className="btn px-4 py-2.5 text-base">로그인</Link>
            <Link href="/b/sample" className="btn px-4 py-2.5 text-base">샘플 플립북 보기</Link>
          </div>
          <p className="text-sm text-neutral-500">가입 후 관리자 승인이 끝나면 이용할 수 있어요.</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(([t, d]) => (
            <li key={t} className="card p-5">
              <p className="font-semibold">{t}</p>
              <p className="muted mt-1 text-sm">{d}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const books = listBooks(user);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">내 책</h1>
          <p className="muted mt-1 text-sm">{books.length}권</p>
        </div>
        <Link href="/books/new" className="btn-primary">+ 새 책 만들기</Link>
      </div>

      {books.length === 0 ? (
        <div className="card flex flex-col items-start gap-3">
          <p className="font-medium">아직 만든 책이 없어요.</p>
          <p className="muted text-sm">원고를 붙여 넣거나 .txt/.md 파일을 가져오면 표지부터 본문까지 자동으로 만들어 드려요.</p>
          <div className="flex gap-2">
            <Link href="/books/new" className="btn-primary">첫 책 만들기</Link>
            <Link href="/b/sample" className="btn">샘플 플립북 보기</Link>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((b) => (
            <li key={b.id} className="group flex flex-col gap-3">
              <Link href={`/books/${b.id}/edit`} className="grid place-items-center rounded-xl bg-neutral-200/60 p-4 transition group-hover:bg-neutral-200">
                <PageThumb book={b.book} page={b.book.pages[0]} width={b.book.size.width >= b.book.size.height ? 200 : 150} className="shadow-md transition group-hover:-translate-y-0.5 group-hover:shadow-lg" />
              </Link>
              <div className="flex flex-col gap-1">
                <Link href={`/books/${b.id}/edit`} className="line-clamp-2 font-semibold hover:underline">{b.title}</Link>
                <p className="muted text-xs">
                  {b.pageCount}쪽 · {fmtDate(b.updatedAt)}
                  {b.slug && <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">공개 중</span>}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Link href={`/books/${b.id}/edit`} className="btn px-2 py-1 text-xs">편집</Link>
                  {b.slug && <Link href={`/b/${b.slug}`} target="_blank" className="btn px-2 py-1 text-xs">보기</Link>}
                  <BookCardActions id={b.id} title={b.title} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
