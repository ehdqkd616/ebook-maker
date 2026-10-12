import { describe, expect, it } from "vitest";
import { buildSignupMail, createMailer, formatKst } from "./mailer";
import { safeNext } from "../format";

describe("가입 메일", () => {
  const u = { username: "kim1234", name: "<김>회원", note: "교재 제작", createdAt: Date.UTC(2026, 9, 12, 0, 5, 9) };

  it("관리자 승인 요청 메일에 회원 정보와 승인 링크를 넣고 HTML을 이스케이프한다", () => {
    const m = buildSignupMail(u, "https://ebook-maker.example/");
    expect(m.subject).toContain("kim1234");
    expect(m.text).toContain("아이디: kim1234");
    expect(m.html).toContain("&lt;김&gt;회원");
    expect(m.html).not.toContain("<김>");
    expect(m.html).toContain("https://ebook-maker.example/admin?tab=users&amp;status=pending");
    expect(m.text).toContain("가입 메모: 교재 제작");
  });

  it("한국 시간으로 표시한다", () => {
    expect(formatKst(u.createdAt)).toBe("2026년 10월 12일 09시 05분 09초");
  });

  it("SMTP 설정이 없으면 보내지 않는다", async () => {
    const mailer = createMailer({ ADMIN_NOTIFY_EMAILS: "admin@test.local" } as unknown as NodeJS.ProcessEnv);
    expect(await mailer.sendSignupNotification(u)).toBe("SKIPPED");
  });
});

describe("safeNext", () => {
  it("같은 사이트 경로만 허용한다", () => {
    expect(safeNext("/admin?tab=users")).toBe("/admin?tab=users");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
