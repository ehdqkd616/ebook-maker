import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookDown,
  BookOpen,
  FileUp,
  FolderInput,
  LayoutTemplate,
  Lock,
  MousePointerClick,
  PlayCircle,
  Share2,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { bookFromTemplate, TEMPLATES } from "@ebook/layouts";
import { BookShelf } from "@/components/BookShelf";
import { HeroBook } from "@/components/HeroBook";
import { PageThumb } from "@/components/PageThumb";
import { getCurrentUser } from "@/lib/server/auth";
import { listBooks } from "@/lib/server/books";
import { sampleBook } from "@/lib/sample-book";
import { Book } from "@ebook/schema";

export const dynamic = "force-dynamic";

// 기능 소개 — 큰 칸 둘(넘김·인터랙티브)과 작은 칸 넷
const BENTO = [
  { icon: BookOpen, title: "진짜 책처럼 넘어가는 플립북", desc: "빛과 그림자가 살아 있는 3D 책장 넘김. 손가락으로 끌어 넘기고, 책 두께까지 보여요.", big: true },
  { icon: MousePointerClick, title: "누르면 반응하는 쪽", desc: "동영상·오디오·슬라이드쇼·상품 태그·버튼·팝업·연락처 받기 폼을 쪽 위에 얹어요.", big: true },
  { icon: FileUp, title: "PDF 그대로, 글자는 고쳐서", desc: "PDF를 올리면 링크·목차까지 살린 플립북이 되고, 글자도 블록으로 바로 고칠 수 있어요.", big: false },
  { icon: LayoutTemplate, title: "템플릿으로 5분 만에", desc: "카탈로그·회사 소개서·교재·행사 안내 등 고쳐 쓰기만 하면 되는 템플릿.", big: false },
  { icon: BarChart3, title: "누가 얼마나 읽었는지", desc: "조회수·쪽별 열람·클릭·유입 경로와 폼으로 모은 연락처를 한눈에.", big: false },
  { icon: BookDown, title: "PDF·EPUB으로 내보내기", desc: "책 크기 그대로 PDF로, 전자책 뷰어용 EPUB(고정 레이아웃)으로 내려받아요.", big: false },
] as const;

const CHIPS = [
  { icon: Lock, label: "비밀번호·링크 공개" },
  { icon: Share2, label: "QR·임베드·SNS 공유" },
  { icon: Type, label: "텍스트로 읽기 모드" },
  { icon: PlayCircle, label: "자동 넘김·배경 음악" },
] as const;

export default async function Home() {
  const user = await getCurrentUser();
  return user ? <Dashboard user={user} /> : <Landing />;
}

function Landing() {
  const book = Book.parse(sampleBook);
  const showcase = TEMPLATES.slice(0, 6).map((t) => ({ t, b: bookFromTemplate(t) }));
  return (
    <div className="overflow-hidden">
      {/* 첫 화면 */}
      <section className="relative">
        <div aria-hidden className="absolute inset-x-0 -top-40 -z-10 h-[680px] bg-[radial-gradient(60%_60%_at_72%_32%,var(--color-brand-200),transparent_70%),radial-gradient(40%_50%_at_8%_8%,#ffe4f1,transparent_70%)] opacity-80" />
        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-20">
          <div className="flex flex-col gap-6">
            <span className="chip w-fit bg-white/80 text-brand-700 ring-1 ring-brand-200"><Sparkles className="size-3" /> PDF·원고·템플릿으로 만드는 디지털 플립북</span>
            <h1 className="text-[40px] leading-[1.15] font-bold tracking-[-0.03em] sm:text-[54px]">
              글만 있으면,<br />
              <span className="bg-gradient-to-r from-brand-600 to-fuchsia-500 bg-clip-text text-transparent">넘겨 보는 책</span>이 됩니다
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-neutral-600">
              PDF를 올리거나 원고를 붙여 넣거나 템플릿을 고르세요. 동영상·상품 태그·폼까지 얹은 플립북을 링크 하나로 공유하고, 누가 얼마나 읽었는지 확인해요.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary px-5 py-3 text-base">무료로 시작하기 <ArrowRight className="size-4" /></Link>
              <Link href="/b/sample" className="btn px-5 py-3 text-base"><BookOpen className="size-4" /> 샘플 플립북 보기</Link>
            </div>
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-500">
              {CHIPS.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5"><c.icon className="size-4 text-brand-500" /> {c.label}</li>
              ))}
            </ul>
          </div>

          <div className="relative mx-auto flex w-full max-w-[560px] min-w-0 items-center justify-center">
            <div aria-hidden className="absolute inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-[#2a2540] to-[#14121d] shadow-[0_40px_80px_-30px_rgba(40,20,90,.55)]" />
            <div aria-hidden className="absolute inset-6 -z-10 rounded-[40px] bg-[radial-gradient(70%_60%_at_50%_0%,rgba(140,110,255,.35),transparent_70%)]" />
            <div className="w-full min-w-0 py-10 flex justify-center">
              <HeroBook book={book} width={460} />
            </div>
            <span className="absolute top-10 right-10 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/70 backdrop-blur">끌어서 넘겨 보세요</span>
          </div>
        </div>
      </section>

      {/* 기능 */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow">Features</p>
          <h2 className="mt-2 text-[30px] leading-tight font-bold tracking-tight">만들고, 꾸미고, 공유하고, 확인까지</h2>
          <p className="mt-2 text-neutral-600">FlipHTML5·Flipsnack·Canva 같은 도구에서 많이 쓰는 기능을 한곳에 모았어요.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-12">
          {BENTO.map((f) => (
            <div
              key={f.title}
              className={`group relative overflow-hidden rounded-3xl border border-black/[0.06] p-6 transition hover:-translate-y-0.5 hover:shadow-lift ${
                f.big ? "bg-ink text-white md:col-span-6 md:min-h-56" : "bg-white md:col-span-6 lg:col-span-3"
              }`}
            >
              {f.big && <div aria-hidden className="absolute -top-20 -right-16 size-64 rounded-full bg-brand-500/30 blur-3xl transition group-hover:bg-brand-400/40" />}
              <span className={`relative grid size-11 place-items-center rounded-xl ${f.big ? "bg-white/10 ring-1 ring-white/15" : "bg-brand-50 text-brand-600"}`}><f.icon className="size-5" /></span>
              <p className={`relative mt-5 font-semibold ${f.big ? "text-xl" : "text-lg"}`}>{f.title}</p>
              <p className={`relative mt-1.5 max-w-md text-sm leading-relaxed ${f.big ? "text-white/70" : "text-neutral-600"}`}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 템플릿 */}
      <section className="border-y border-black/[0.05] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Templates</p>
              <h2 className="mt-2 text-[30px] leading-tight font-bold tracking-tight">빈 화면 대신 템플릿에서 시작하세요</h2>
            </div>
            <Link href="/signup" className="btn">템플릿 모두 보기 <ArrowRight className="size-4" /></Link>
          </div>
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-6">
            {showcase.map(({ t, b }) => {
              const w = b.size.width > b.size.height ? 150 : b.size.width === b.size.height ? 120 : 104;
              return (
                <li key={t.id} className="group flex flex-col items-center gap-3">
                  <div className="grid h-44 w-full place-items-center rounded-2xl bg-gradient-to-b from-neutral-50 to-neutral-100 ring-1 ring-black/[0.04]">
                    <div className="shadow-lift transition duration-300 group-hover:-translate-y-1.5 group-hover:-rotate-2">
                      <PageThumb book={b} page={b.pages[0]} width={w} className="!ring-0" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.category}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* 마지막 권유 */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-[32px] bg-ink px-8 py-14 text-center text-white sm:px-16">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_0%,rgba(124,92,255,.45),transparent_70%)]" />
          <h2 className="relative text-[28px] leading-tight font-bold tracking-tight sm:text-[36px]">첫 플립북을 지금 만들어 보세요</h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/70">PDF 하나면 충분해요. 가입 후 관리자 승인이 끝나면 바로 이용할 수 있어요.</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">무료로 시작하기 <ArrowRight className="size-4" /></Link>
            <Link href="/b/sample" className="btn border-white/20 bg-white/10 px-6 py-3 text-base text-white hover:bg-white/20">샘플 보기</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const START = [
  { href: "/books/new?start=template", icon: LayoutTemplate, title: "템플릿으로 시작", desc: "카탈로그·소개서·교재 등 예시를 고쳐 써요.", dark: false },
  { href: "/books/new?start=pdf", icon: FileUp, title: "PDF로 플립북 만들기", desc: "PDF를 쪽 그대로, 또는 글자를 고칠 수 있게 가져와요.", dark: true },
  { href: "/books/new", icon: Wand2, title: "원고로 새로 디자인", desc: "원고를 붙여 넣으면 표지부터 본문까지 자동 조판해요.", dark: false },
] as const;

async function Dashboard({ user }: { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>> }) {
  const books = listBooks(user);
  const live = books.filter((b) => b.slug).length;
  const views = books.reduce((s, b) => s + b.views, 0);
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My Library</p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">{user.name || user.username}님의 책장</h1>
          <p className="mt-1 text-sm text-neutral-500">
            책 {books.length}권 · 공개 중 {live}권 · 누적 조회 {views.toLocaleString()}회
          </p>
        </div>
        <Link href={`/u/${user.username}`} className="btn text-sm" target="_blank">공개 책장 보기</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {START.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`group relative overflow-hidden rounded-2xl p-6 transition hover:-translate-y-0.5 ${
              s.dark ? "bg-ink text-white shadow-lift" : "border border-black/[0.06] bg-white shadow-soft hover:shadow-lift"
            }`}
          >
            <div aria-hidden className={`absolute -top-16 -right-10 size-56 rounded-full blur-3xl transition ${s.dark ? "bg-brand-500/40 group-hover:bg-brand-400/50" : "bg-brand-100"}`} />
            <span className={`relative grid size-11 place-items-center rounded-xl ${s.dark ? "bg-white/10 ring-1 ring-white/15" : "bg-brand-50 text-brand-600 ring-1 ring-brand-100"}`}><s.icon className="size-5" /></span>
            <p className="relative mt-5 text-lg font-semibold">{s.title}</p>
            <p className={`relative mt-1 max-w-xs text-sm ${s.dark ? "text-white/70" : "text-neutral-500"}`}>{s.desc}</p>
            <ArrowRight className={`absolute right-6 bottom-6 size-5 transition group-hover:translate-x-1 ${s.dark ? "text-white/60 group-hover:text-white" : "text-neutral-400 group-hover:text-brand-600"}`} />
          </Link>
        ))}
      </div>

      <Link href="/books/new?start=flip" className="-mt-6 flex items-center gap-2 self-start rounded-xl px-1 text-sm text-neutral-500 hover:text-brand-700">
        <FolderInput className="size-4" /> FlipHTML5로 만든 책이 있나요? 폴더째 가져와서 이어서 고치기 <ArrowRight className="size-3.5" />
      </Link>

      <BookShelf items={books} />
    </div>
  );
}
