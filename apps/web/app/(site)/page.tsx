import Link from "next/link";
import { ArrowRight, BookOpen, FileUp, LayoutTemplate, MousePointer2, Share2, Sparkles, Wand2 } from "lucide-react";
import { BookCardActions } from "@/components/BookCardActions";
import { BookCover } from "@/components/BookCover";
import { PageThumb } from "@/components/PageThumb";
import { getCurrentUser } from "@/lib/server/auth";
import { listBooks } from "@/lib/server/books";
import { fmtDate } from "@/lib/format";
import { sampleBook } from "@/lib/sample-book";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: FileUp, title: "PDF를 그대로 플립북으로", desc: "이미 만든 PDF를 올리면 페이지 그대로 책장 넘기는 플립북이 돼요. 링크·글·이미지를 더 얹을 수 있어요." },
  { icon: Wand2, title: "원고만 넣으면 자동 디자인", desc: "PDF·Word·텍스트 원고에서 글을 꺼내 표지·목차·챕터·본문 페이지로 자동 조판해요." },
  { icon: MousePointer2, title: "끌어서 고치는 에디터", desc: "블록을 끌어 옮기고 더블클릭해 바로 고쳐요. 레이아웃·테마는 클릭 한 번이면 바뀌어요." },
  { icon: Share2, title: "링크 하나로 공유", desc: "공유 주소·QR·임베드 코드로 어디든 붙이고, 책 크기 그대로 PDF로 저장해요." },
] as const;

const STEPS = [
  { icon: FileUp, title: "올리기", desc: "PDF나 원고를 넣거나 직접 써요" },
  { icon: LayoutTemplate, title: "다듬기", desc: "테마·레이아웃을 고르고 고쳐요" },
  { icon: BookOpen, title: "공유하기", desc: "플립북 주소로 바로 보여줘요" },
] as const;

export default async function Home() {
  const user = await getCurrentUser();
  return user ? <Dashboard user={user} /> : <Landing />;
}

function Landing() {
  const spread = sampleBook.pages.slice(1, 3);
  return (
    <div className="overflow-hidden">
      <section className="relative">
        <div aria-hidden className="absolute inset-x-0 -top-40 -z-10 h-[620px] bg-[radial-gradient(60%_60%_at_70%_30%,var(--color-brand-200),transparent_70%),radial-gradient(40%_50%_at_10%_10%,#ffe4f1,transparent_70%)] opacity-80" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
          <div className="flex flex-col gap-6">
            <span className="chip w-fit bg-white/80 text-brand-700 ring-1 ring-brand-200"><Sparkles className="size-3" /> PDF·원고로 만드는 디지털 플립북</span>
            <h1 className="text-[42px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[54px]">
              글만 있으면,<br />
              <span className="bg-gradient-to-r from-brand-600 to-fuchsia-500 bg-clip-text text-transparent">넘겨 보는 책</span>이 됩니다
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-neutral-600">
              PDF를 올리거나 원고를 붙여 넣으면 디자인된 전자책으로 만들어 드려요. 웹에서 다듬고, 책장 넘기는 플립북 링크로 공유하세요.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary px-5 py-3 text-base">무료로 시작하기 <ArrowRight className="size-4" /></Link>
              <Link href="/b/sample" className="btn px-5 py-3 text-base"><BookOpen className="size-4" /> 샘플 플립북 보기</Link>
            </div>
            <p className="text-sm text-neutral-500">가입 후 관리자 승인이 끝나면 바로 이용할 수 있어요.</p>
          </div>

          <div className="relative mx-auto flex h-[420px] w-full max-w-[520px] items-center justify-center [perspective:1600px]">
            <div className="absolute inset-x-10 bottom-6 h-10 rounded-[50%] bg-black/25 blur-2xl" />
            <div className="flex [transform:rotateX(14deg)_rotateY(-16deg)_rotateZ(2deg)] shadow-lift">
              {spread.map((p, i) => (
                <div key={p.id} className={i === 0 ? "[mask-image:linear-gradient(90deg,#000_88%,rgba(0,0,0,.8))]" : ""}>
                  <PageThumb book={sampleBook} page={p} width={220} className="!ring-0" />
                </div>
              ))}
            </div>
            <BookCover book={sampleBook} width={150} className="absolute bottom-4 left-0 -rotate-6" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-center gap-4 rounded-2xl border border-black/[0.06] bg-white/70 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><s.icon className="size-5" /></span>
              <div>
                <p className="text-xs font-semibold text-brand-600">STEP {i + 1}</p>
                <p className="font-semibold">{s.title}</p>
                <p className="muted text-sm">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-black/[0.05] bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-20 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex flex-col gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-ink text-white"><f.icon className="size-5" /></span>
              <p className="font-semibold">{f.title}</p>
              <p className="text-sm leading-relaxed text-neutral-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function Dashboard({ user }: { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }) {
  const books = listBooks(user);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">My Library</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-[28px] font-bold tracking-tight">{user.name || user.username}님의 책장</h1>
          <Link href={`/u/${user.username}`} className="btn text-sm" target="_blank">공개 책장 보기</Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/books/new?start=pdf" className="group relative overflow-hidden rounded-2xl bg-ink p-6 text-white shadow-lift transition hover:-translate-y-0.5">
          <div aria-hidden className="absolute -top-16 -right-10 size-56 rounded-full bg-brand-500/40 blur-3xl transition group-hover:bg-brand-400/50" />
          <span className="relative grid size-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><FileUp className="size-5" /></span>
          <p className="relative mt-5 text-lg font-semibold">PDF로 플립북 만들기</p>
          <p className="relative mt-1 max-w-sm text-sm text-white/70">이미 만든 PDF를 페이지 그대로 책장 넘기는 플립북으로 바꿔요.</p>
          <ArrowRight className="absolute right-6 bottom-6 size-5 text-white/60 transition group-hover:translate-x-1 group-hover:text-white" />
        </Link>
        <Link href="/books/new" className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
          <div aria-hidden className="absolute -top-16 -right-10 size-56 rounded-full bg-brand-100 blur-3xl" />
          <span className="relative grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Wand2 className="size-5" /></span>
          <p className="relative mt-5 text-lg font-semibold">새 책 디자인하기</p>
          <p className="relative mt-1 max-w-sm text-sm text-neutral-500">원고를 붙여 넣거나 PDF·Word에서 글을 가져와 표지부터 본문까지 자동으로 짜요.</p>
          <ArrowRight className="absolute right-6 bottom-6 size-5 text-neutral-400 transition group-hover:translate-x-1 group-hover:text-brand-600" />
        </Link>
      </div>

      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">내 책 <span className="ml-1 text-neutral-400">{books.length}</span></h2>
        </div>
        {books.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-black/10 bg-white/60 px-6 py-16 text-center">
            <BookOpen className="size-8 text-neutral-300" />
            <p className="mt-3 font-medium">아직 만든 책이 없어요</p>
            <p className="muted mt-1 text-sm">위에서 PDF를 올리거나 새 책을 만들어 보세요.</p>
            <Link href="/b/sample" className="btn mt-4">샘플 플립북 둘러보기</Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((b) => {
              const landscape = b.book.size.width >= b.book.size.height;
              return (
                <li key={b.id} className="group flex flex-col gap-4">
                  <Link
                    href={`/books/${b.id}/edit`}
                    className="relative grid h-60 place-items-center rounded-2xl bg-gradient-to-b from-neutral-100 to-neutral-200/70 ring-1 ring-black/[0.04] transition group-hover:from-brand-50 group-hover:to-brand-100/60"
                  >
                    <BookCover book={b.book} width={landscape ? 180 : 128} className="transition duration-300 group-hover:-translate-y-1.5 group-hover:-rotate-1" />
                    {b.slug && <span className="chip absolute top-3 left-3 bg-emerald-500 text-white">공개 중</span>}
                  </Link>
                  <div className="flex flex-col gap-1 px-0.5">
                    <Link href={`/books/${b.id}/edit`} className="line-clamp-1 font-semibold hover:text-brand-700">{b.title}</Link>
                    <p className="text-xs text-neutral-500">{b.pageCount}쪽 · {fmtDate(b.updatedAt)}</p>
                    <div className="mt-2 flex items-center gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                      <Link href={`/books/${b.id}/edit`} className="btn px-2.5 py-1 text-xs">편집</Link>
                      {b.slug && <Link href={`/b/${b.slug}`} target="_blank" className="btn px-2.5 py-1 text-xs">보기</Link>}
                      {b.slug && <Link href={`/books/${b.id}/stats`} className="btn px-2.5 py-1 text-xs">통계</Link>}
                      <BookCardActions id={b.id} title={b.title} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
