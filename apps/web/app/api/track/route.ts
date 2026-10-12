import { getPublished } from "@/lib/server/books";
import { clientIp, readJson, route, str } from "@/lib/server/http";
import { getLimits } from "@/lib/server/limits";
import { recordEvent, visitorId } from "@/lib/server/stats";

// 뷰어 → 열람 통계. 공개본만 받고, 본인 책을 본인이 열어 본 건 따로 거르지 않는다(단순 집계).
export const POST = route(async (req) => {
  const ip = clientIp(req);
  getLimits().track.check(ip);
  const body = await readJson(req);
  const pub = getPublished(str(body.slug, 30));
  const event = body.event;
  if (!pub || (event !== "view" && event !== "page" && event !== "click")) return { ok: false };
  const ua = req.headers.get("user-agent") ?? "";
  let referrer: string | null = null;
  try {
    const r = req.headers.get("referer");
    const host = r ? new URL(r).host : null;
    // 우리 사이트 안(공개 주소 자체)에서 온 건 빼고 바깥 사이트만 남긴다
    if (host && host !== req.headers.get("host")) referrer = host;
  } catch {}
  const page = Number(body.page);
  recordEvent({
    bookId: pub.bookId,
    event,
    page: Number.isInteger(page) && page > 0 && page <= pub.book.pages.length ? page : null,
    blockId: event === "click" ? str(body.block, 60) || null : null,
    visitor: visitorId(ip, ua),
    referrer: event === "view" ? (str(body.referrer, 200) || referrer) : null,
    device: /Mobi|Android|iPhone|iPad/i.test(ua) ? "mobile" : "desktop",
  });
  return { ok: true };
});
