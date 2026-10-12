// 서버 기동 시 한 번: 관리자 계정 자동 생성
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureAdmin } = await import("./lib/server/auth");
    await ensureAdmin();
  }
}
