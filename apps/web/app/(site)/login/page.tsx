import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/server/auth";
import { safeNext } from "@/lib/format";

export const metadata = { title: "로그인 · Ebook Maker" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <LoginForm next={next} />
    </div>
  );
}
