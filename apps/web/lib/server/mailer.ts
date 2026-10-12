import nodemailer, { type Transporter } from "nodemailer";

// 회원가입 승인 요청 메일 (다른 프로젝트와 같은 SMTP 계정·디자인).
// 가입하면 관리자(ADMIN_NOTIFY_EMAILS)에게 보낸다. 회원은 이메일 없이 아이디로 가입하므로 회원에게 가는 메일은 없다.
// SMTP 계정이 비어 있으면 조용히 건너뛰고, 응답과 분리해서 보내므로 실패해도 가입·승인은 그대로 성공한다.

const APP_NAME = "Ebook Maker";
const ACCENT = "#2f4b8f";
const INK = "#0f1115";

export type MailResult = "SENT" | "SKIPPED" | "FAILED";
type Mail = { subject: string; html: string; text: string };

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function formatKst(ms: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}년 ${parts.month}월 ${parts.day}일 ${parts.hour}시 ${parts.minute}분 ${parts.second}초`;
}

function row(label: string, value: string, last: boolean) {
  return `<tr><td style="padding:16px 18px;${last ? "" : "border-bottom:1px solid #e5e7eb;"}">
  <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${label}</div>
  <div style="font-size:16px;font-weight:600;color:#111827;word-break:break-all;white-space:pre-wrap;">${value}</div>
</td></tr>`;
}

// 메일 클라이언트(특히 Gmail/Outlook)는 <style>과 flex를 제대로 지원하지 않아서 테이블 + 인라인 스타일로만 짠다.
function layout(o: {
  preheader: string; header: string; badge: { text: string; bg: string; fg: string }; title: string; lead: string;
  fields: [string, string][]; button?: { text: string; url: string }; footer: string;
}) {
  const fieldRows = o.fields.length
    ? `<tr><td style="padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
            ${o.fields.map(([l, v], i) => row(l, esc(v), i === o.fields.length - 1)).join("\n")}
          </table>
        </td></tr>`
    : "";
  const button = o.button
    ? `<tr><td align="center" style="padding:8px 28px 32px;">
          <a href="${esc(o.button.url)}" target="_blank"
             style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:10px;">${o.button.text}</a>
          <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;word-break:break-all;">
            버튼이 안 눌리면 이 주소로 들어가세요: <a href="${esc(o.button.url)}" style="color:#6b7280;">${esc(o.button.url)}</a>
          </p>
        </td></tr>`
    : `<tr><td style="padding:0 0 12px;"></td></tr>`;
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;
                    font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;">
        <tr><td style="background:${INK};padding:22px 28px;">
          <span style="color:#a5b4fc;font-size:18px;font-weight:700;letter-spacing:.3px;">${APP_NAME}</span>
          <span style="color:#9ca3af;font-size:13px;margin-left:8px;">${o.header}</span>
        </td></tr>
        <tr><td style="padding:32px 28px 8px;">
          <div style="display:inline-block;background:${o.badge.bg};color:${o.badge.fg};font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;">${o.badge.text}</div>
          <h1 style="margin:14px 0 8px;font-size:22px;line-height:1.4;color:#111827;">${o.title}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">${o.lead}</p>
        </td></tr>
        ${fieldRows}
        ${button}
        <tr><td style="background:#f9fafb;padding:16px 28px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">${o.footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const base = (url: string) => url.replace(/\/$/, "");

export function buildSignupMail(u: { username: string; name: string; note?: string | null; createdAt: number }, publicWebUrl: string): Mail {
  const adminUrl = `${base(publicWebUrl)}/admin?tab=users&status=pending`;
  const fields: [string, string][] = [
    ["아이디", u.username],
    ["이름", u.name],
    ["가입 일시 (한국 시간)", formatKst(u.createdAt)],
    ...(u.note ? ([["가입 메모", u.note]] as [string, string][]) : []),
  ];
  const html = layout({
    preheader: `${u.name}(${u.username}) 님이 가입했습니다. 승인을 기다리고 있어요.`,
    header: "관리자 알림",
    badge: { text: "승인 대기", bg: "#eef2ff", fg: "#4338ca" },
    title: "새 회원이 가입했어요",
    lead: "아래 회원이 가입을 신청했습니다. 승인해야 로그인할 수 있어요.",
    fields,
    button: { text: "관리자 페이지에서 승인하기", url: adminUrl },
    footer: `이 메일은 ${APP_NAME} 회원가입 시 자동으로 발송됩니다.`,
  });
  const text = [
    `[${APP_NAME}] 새 회원가입 승인 요청`, "",
    ...fields.map(([l, v]) => `${l}: ${v}`), "",
    "승인해야 로그인할 수 있어요. 아래 관리자 페이지에서 승인해 주세요.", adminUrl,
  ].join("\n");
  return { subject: `[${APP_NAME}] ${u.name}(${u.username}) 님이 가입했어요 — 승인해 주세요`, html, text };
}

export function createMailer(env: NodeJS.ProcessEnv = process.env) {
  const smtp = {
    host: env.SMTP_HOST || "smtp.gmail.com",
    port: Number(env.SMTP_PORT) || 587,
    user: env.SMTP_USER ?? "",
    password: env.SMTP_PASSWORD ?? "",
    from: env.SMTP_FROM ?? "",
  };
  const adminRecipients = (env.ADMIN_NOTIFY_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const publicWebUrl = env.PUBLIC_WEB_URL || "http://localhost:3000";
  let transport: Transporter | null = null;

  async function send(to: string[], m: Mail, label: string): Promise<MailResult> {
    if (!smtp.user || !smtp.password) {
      console.warn(`[mail] SMTP 설정이 없어 메일을 건너뜁니다 (${label})`);
      return "SKIPPED";
    }
    if (!to.length) return "SKIPPED";
    transport ??= nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465, // 587은 STARTTLS
      requireTLS: smtp.port !== 465,
      auth: { user: smtp.user, pass: smtp.password },
      connectionTimeout: 20_000,
    });
    try {
      await transport.sendMail({ from: { name: `${APP_NAME} 알림`, address: smtp.from || smtp.user }, to, ...m });
      console.log(`[mail] 발송: ${label} -> ${to.join(", ")}`);
      return "SENT";
    } catch (err) {
      console.error(`[mail] 발송 실패 (${label})`, err);
      return "FAILED";
    }
  }

  return {
    sendSignupNotification: (u: Parameters<typeof buildSignupMail>[0]) =>
      send(adminRecipients, buildSignupMail(u, publicWebUrl), `가입 알림 ${u.username}`),
  };
}

const g = globalThis as unknown as { __ebookMailer?: ReturnType<typeof createMailer> };
export function getMailer() {
  g.__ebookMailer ??= createMailer();
  return g.__ebookMailer;
}

/** 응답을 기다리게 하지 않고 보낸다 */
export function sendInBackground(p: Promise<MailResult>) {
  void p.catch((err) => console.error(err));
}
