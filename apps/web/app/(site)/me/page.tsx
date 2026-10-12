import { redirect } from "next/navigation";
import { MyPage } from "@/components/MyPage";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "내 정보 · Ebook Maker" };

export default async function MePage() {
  if (!(await getCurrentUser())) redirect("/login?next=/me");
  return <MyPage />;
}
