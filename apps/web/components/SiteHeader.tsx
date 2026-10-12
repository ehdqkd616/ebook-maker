import Link from "next/link";
import { getCurrentUser } from "@/lib/server/auth";
import { getStore } from "@/lib/server/store";
import { LogoutButton } from "./LogoutButton";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const pending =
    user?.role === "admin" ? (getStore().get<{ n: number }>("SELECT COUNT(*) n FROM users WHERE status = 'pending'")?.n ?? 0) : 0;
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Ebook Maker
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link href="/admin" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">
                  관리자
                  {pending > 0 && (
                    <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">{pending}</span>
                  )}
                </Link>
              )}
              <Link href="/me" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">
                {user.name} 님
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-3 py-1.5 hover:bg-neutral-100">로그인</Link>
              <Link href="/signup" className="rounded-lg bg-neutral-900 px-3 py-1.5 text-white hover:bg-neutral-700">회원가입</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
