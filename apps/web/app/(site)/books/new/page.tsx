import { redirect } from "next/navigation";
import { NewBookWizard } from "@/components/wizard/NewBookWizard";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "새 책 만들기 · Ebook Maker" };

export default async function NewBookPage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  if (!(await getCurrentUser())) redirect("/login?next=/books/new");
  return <NewBookWizard startWithPdf={(await searchParams).start === "pdf"} />;
}
