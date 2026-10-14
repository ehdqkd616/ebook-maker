"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, MousePointerClick, Smartphone, Users, BookOpen, Download, Mail } from "lucide-react";
import { LEAD_FIELD_LABEL, LEAD_FIELDS, type LeadField } from "@ebook/schema";
import { api } from "@/lib/api";
import { LogoMark } from "./Logo";

type Stats = {
  days: number;
  totals: { views: number | null; visitors: number | null; pages: number | null; clicks: number | null };
  daily: { day: string; views: number; visitors: number }[];
  pages: { page: number; views: number }[];
  clicks: { blockId: string; page: number; clicks: number }[];
  referrers: { host: string; views: number }[];
  devices: { device: string; views: number }[];
  avgPagesPerVisitor: number;
};

const RANGES = [7, 30, 90] as const;

type Lead = { id: number; page: number | null; createdAt: number } & Partial<Record<LeadField, string>>;

export function BookStats({ bookId, title, pageCount, slug, blockLabels }: { bookId: string; title: string; pageCount: number; slug: string | null; blockLabels: Record<string, string> }) {
  const [days, setDays] = useState<number>(30);
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  useEffect(() => {
    api<{ leads: Lead[] }>(`/api/books/${bookId}/leads`).then((r) => setLeads(r.leads), () => setLeads([]));
  }, [bookId]);
  const leadCols = LEAD_FIELDS.filter((f) => leads?.some((l) => l[f]));
  useEffect(() => {
    setS(null);
    api<Stats>(`/api/books/${bookId}/stats?days=${days}`).then(setS, (e) => setError(e.message));
  }, [bookId, days]);

  const n = (v: number | null | undefined) => (v ?? 0).toLocaleString();
  const mobile = s?.devices.find((d) => d.device === "mobile")?.views ?? 0;
  const allDev = s?.devices.reduce((a, d) => a + d.views, 0) ?? 0;

  // 기간 안의 날짜를 빠짐없이 (방문 없는 날은 0)
  const series = (() => {
    if (!s) return [];
    const map = new Map(s.daily.map((d) => [d.day, d]));
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() + 9 * 3600_000 - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day: d, views: map.get(d)?.views ?? 0, visitors: map.get(d)?.visitors ?? 0 };
    });
  })();
  const pageSeries = Array.from({ length: pageCount }, (_, i) => ({ page: i + 1, views: s?.pages.find((p) => p.page === i + 1)?.views ?? 0 }));

  return (
    <div className="min-h-dvh">
      <header className="glass sticky top-0 z-10 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href={`/books/${bookId}/edit`} className="btn-ghost"><ArrowLeft className="size-4" /> 편집으로</Link>
          <LogoMark size={22} />
          <span className="truncate font-semibold">{title}</span>
          <div className="seg ml-auto">
            {RANGES.map((r) => (
              <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>{r}일</button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1 className="mt-1 text-[26px] font-bold tracking-tight">열람 통계</h1>
          {!slug && <p className="banner-warn mt-3">아직 퍼블리시하지 않은 책이에요. 공개 주소로 본 기록만 모아요.</p>}
        </div>
        {error && <p className="banner-error">{error}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile icon={Eye} label="조회수" value={s ? n(s.totals.views) : "…"} />
          <Tile icon={Users} label="방문자" value={s ? n(s.totals.visitors) : "…"} hint="하루 단위 고유 방문" />
          <Tile icon={BookOpen} label="방문당 본 쪽수" value={s ? `${s.avgPagesPerVisitor}쪽` : "…"} hint={`전체 ${pageCount}쪽`} />
          <Tile icon={MousePointerClick} label="링크·요소 클릭" value={s ? n(s.totals.clicks) : "…"} />
          <Tile icon={Smartphone} label="모바일 비율" value={s ? (allDev ? `${Math.round((mobile / allDev) * 100)}%` : "—") : "…"} />
        </div>

        <section className="card">
          <h2 className="font-semibold">날짜별 조회수</h2>
          <p className="muted text-sm">최근 {days}일 · 막대에 마우스를 올리면 숫자가 보여요</p>
          <Bars data={series.map((d) => ({ key: d.day, label: d.day.slice(5).replace("-", "."), value: d.views, tip: `${d.day} · 조회 ${d.views} · 방문자 ${d.visitors}` }))} height={180} />
        </section>

        <section className="card">
          <h2 className="font-semibold">쪽별로 넘겨 본 횟수</h2>
          <p className="muted text-sm">어느 쪽에서 많이 머물렀는지, 어디서 그만 읽었는지 보여요</p>
          <Bars data={pageSeries.map((p) => ({ key: String(p.page), label: String(p.page), value: p.views, tip: `${p.page}쪽 · ${p.views}회` }))} height={140} />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <h2 className="mb-3 font-semibold">많이 누른 요소</h2>
            {s && s.clicks.length === 0 ? <p className="muted text-sm">아직 기록이 없어요.</p> : (
              <table className="grid-table">
                <thead><tr><th>요소</th><th className="text-right">쪽</th><th className="text-right">클릭</th></tr></thead>
                <tbody>
                  {s?.clicks.map((c) => (
                    <tr key={c.blockId}><td className="max-w-60 truncate">{blockLabels[c.blockId] ?? "(지운 요소)"}</td><td className="text-right tabular-nums">{c.page}</td><td className="text-right font-semibold tabular-nums">{c.clicks}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section className="card">
            <h2 className="mb-3 font-semibold">어디서 왔나요</h2>
            {s && s.referrers.length === 0 ? <p className="muted text-sm">아직 기록이 없어요.</p> : (
              <table className="grid-table">
                <thead><tr><th>들어온 곳</th><th className="text-right">조회</th></tr></thead>
                <tbody>{s?.referrers.map((r) => <tr key={r.host}><td>{r.host}</td><td className="text-right tabular-nums">{r.views}</td></tr>)}</tbody>
              </table>
            )}
          </section>
        </div>

        <section className="card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold"><Mail className="size-4 text-brand-600" /> 모은 연락처 <span className="text-neutral-400">{leads?.length ?? 0}</span></h2>
              <p className="muted text-sm">책 안의 &quot;연락처 받기&quot; 폼으로 독자가 보낸 내용이에요 (기간과 상관없이 최근 1000건).</p>
            </div>
            {!!leads?.length && (
              <a className="btn" href={`/api/books/${bookId}/leads?format=csv`}><Download className="size-4" /> CSV 받기</a>
            )}
          </div>
          {leads && leads.length === 0 ? (
            <p className="muted text-sm">아직 없어요. 에디터의 인터랙티브 요소에서 <b>연락처 받기</b>를 넣어 보세요.</p>
          ) : (
            <div className="max-h-96 overflow-auto">
              <table className="grid-table">
                <thead><tr><th>받은 시각</th><th className="text-right">쪽</th>{leadCols.map((f) => <th key={f}>{LEAD_FIELD_LABEL[f]}</th>)}</tr></thead>
                <tbody>
                  {leads?.map((l) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap text-neutral-500 tabular-nums">{new Date(l.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="text-right tabular-nums">{l.page ?? "-"}</td>
                      {leadCols.map((f) => <td key={f} className="max-w-72 truncate" title={l[f]}>{l[f] ?? ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Tile({ icon: Icon, label, value, hint }: { icon: typeof Eye; label: string; value: string; hint?: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm text-neutral-500"><Icon className="size-4" /> {label}</div>
      <div className="mt-2 text-[28px] leading-none font-bold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-neutral-400">{hint}</div>}
    </div>
  );
}

/** 한 계열 막대 그래프 — 막대 끝만 둥글게, 막대 사이 2px 틈, 가벼운 기준선, 마우스 올리면 값 */
function Bars({ data, height }: { data: { key: string; label: string; value: number; tip: string }[]; height: number }) {
  // 눈금이 정수로 떨어지게 짝수로 올린다 (최댓값 1일 때 "1, 1" 눈금 방지)
  const max = Math.max(2, Math.ceil(Math.max(...data.map((d) => d.value), 0) / 2) * 2);
  const every = Math.ceil(data.length / 12);
  return (
    <div className="mt-5" role="img" aria-label="막대 그래프">
      <div className="relative flex items-end gap-[2px] border-b border-black/10" style={{ height }}>
        {[0.5, 1].map((g) => (
          <div key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-black/[0.06]" style={{ bottom: height * g }}>
            <span className="absolute -top-2.5 -left-0.5 -translate-x-full pr-1 text-[10px] text-neutral-400 tabular-nums">{Math.round(max * g)}</span>
          </div>
        ))}
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] bg-brand-500 transition group-hover:bg-brand-700" style={{ height: d.value ? `${Math.max(2, (d.value / max) * 100)}%` : 0 }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block">{d.tip}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-neutral-400">
        {data.map((d, i) => <span key={d.key} className="flex-1 text-center tabular-nums">{i % every === 0 ? d.label : ""}</span>)}
      </div>
    </div>
  );
}
