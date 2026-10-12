import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "회원가입 · Ebook Maker" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <SignupForm />
    </div>
  );
}
