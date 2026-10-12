import { redirect } from "next/navigation";
import { AdminPanel, type AdminTab } from "@/components/admin/AdminPanel";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "관리자 · Ebook Maker" };

const TABS: AdminTab[] = ["dashboard", "users", "books", "audit"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="banner-error">관리자만 접근할 수 있습니다.</div>
      </div>
    );
  }
  const { tab, status } = await searchParams;
  return (
    <AdminPanel
      initialTab={TABS.includes(tab as AdminTab) ? (tab as AdminTab) : "dashboard"}
      initialStatus={status ?? ""}
      currentUserId={user.id}
    />
  );
}
