"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost"
      title="로그아웃"
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/");
        router.refresh();
      }}
    >
      <LogOut className="size-4" />
      <span className="hidden sm:inline">로그아웃</span>
    </button>
  );
}
