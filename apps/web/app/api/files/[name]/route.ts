import { readImage } from "@/lib/server/uploads";

type Ctx = { params: Promise<{ name: string }> };

// 공개 플립북에서도 쓰는 이미지라 로그인 없이 내준다 (이름은 추측할 수 없는 무작위 값)
export async function GET(req: Request, { params }: Ctx) {
  const file = await readImage((await params).name);
  if (!file) return new Response("Not found", { status: 404 });
  // 오디오·동영상 탐색(건너뛰기)을 위한 Range 요청
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = file.body.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(file.body.subarray(start, end + 1)), {
      status: 206,
      headers: {
        "Content-Type": file.mime,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": file.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
