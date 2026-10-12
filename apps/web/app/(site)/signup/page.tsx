import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { getCurrentUser } from "@/lib/server/auth";

export const metadata = { title: "회원가입 · Ebook Maker" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthShell>
      <SignupForm />
    </AuthShell>
  );
}
