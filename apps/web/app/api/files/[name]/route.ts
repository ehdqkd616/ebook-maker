import { readImage } from "@/lib/server/uploads";

type Ctx = { params: Promise<{ name: string }> };

// 공개 플립북에서도 쓰는 이미지라 로그인 없이 내준다 (이름은 추측할 수 없는 무작위 값)
export async function GET(_req: Request, { params }: Ctx) {
  const file = await readImage((await params).name);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.body), {
    headers: {
      "Content-Type": file.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
