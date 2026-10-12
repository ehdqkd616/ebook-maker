import Link from "next/link";
import { Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const pending =
    user?.role === "admin" ? (getStore().get<{ n: number }>("SELECT COUNT(*) n FROM users WHERE status = 'pending'")?.n ?? 0) : 0;
  return (
    <header className="glass sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Ebook Maker 홈">
          <Logo />
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="btn-ghost">
                  <Shield className="size-4" />
                  <span className="hidden sm:inline">관리자 페이지</span>
                  {pending > 0 && <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">{pending}</span>}
                </Link>
              )}
              <Link href="/me" title={user.username} className="btn-ghost">
                <span className="grid size-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {(user.name || user.username).slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline">내 정보</span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">로그인</Link>
              <Link href="/signup" className="btn-primary py-2 text-sm">무료로 시작하기</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
