import { cookies } from "next/headers";
import { unlockCookieName } from "@/lib/server/books";
import { clientIp, readJson, route } from "@/lib/server/http";
import { saveLead } from "@/lib/server/leads";
import { getLimits } from "@/lib/server/limits";

type Ctx = { params: Promise<{ slug: string }> };

// 공개 플립북의 "연락처 받기" 폼 제출 (로그인 없이)
export const POST = route<Ctx>(async (req, { params }) => {
  const { slug } = await params;
  getLimits().lead.check(clientIp(req));
  saveLead(slug, await readJson(req), (await cookies()).get(unlockCookieName(slug))?.value);
  return { ok: true };
});
