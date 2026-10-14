import { requireUser } from "@/lib/server/auth";
import { getOwnedBook } from "@/lib/server/books";
import { route } from "@/lib/server/http";
import { leadsCsv, listLeads } from "@/lib/server/leads";

type Ctx = { params: Promise<{ id: string }> };

// 이 책으로 모은 연락처 — ?format=csv면 파일로 내려 준다
export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const row = getOwnedBook(id, user);
  const leads = listLeads(id);
  if (new URL(req.url).searchParams.get("format") === "csv") {
    const name = encodeURIComponent(`${row.title || "책"}-연락처.csv`);
    return new Response(leadsCsv(leads), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${name}`, "Cache-Control": "no-store" },
    });
  }
  return { leads };
});
