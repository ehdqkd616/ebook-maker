# ebook-maker

> 🔗 **배포 주소:** https://ebook-maker.hotgarlic.dedyn.io

주제/파일 → AI 아웃라인 → AI 레이아웃 → 편집 → 플립북 퍼블리시. 설계는 [ebook-generator-guide.md](ebook-generator-guide.md) 참고.
현재 구현 범위: 16장 **1주차**(스키마·레이아웃·렌더러·플립북 뷰어) + 회원·관리자(다른 프로젝트와 같은 승인제).

## 빠른 시작

요구 사항: Node.js 22.13 이상(내장 `node:sqlite` 사용)

```bash
npm install
cp apps/web/.env.example apps/web/.env   # 관리자 계정·SMTP 입력
npm run dev                              # http://localhost:3000 (샘플 플립북: /b/sample)
npm test                                 # vitest
npm run typecheck
```

## 배포 (https://ebook-maker.hotgarlic.dedyn.io)

- 앱은 pm2 프로세스 `ebook-maker`로 **127.0.0.1:3400**에만 바인딩된다. 외부 접근은 Caddy(HTTPS)만 가능.
  `pm2 save`로 저장되어 있어 재부팅 시 `pm2-rudy` 서비스가 다시 띄운다.
- 비밀값은 `apps/web/.env`(권한 600, git 제외). 형식은 `apps/web/.env.example`.
- Caddy 설정: `deploy/Caddyfile.ebook-maker` (HSTS, 요청 본문 60MB 제한). `X-Frame-Options`는 플립북 임베드 때문에 앱이 붙인다.
- 회원·세션·감사 로그 DB: `apps/web/storage/ebook.sqlite` (권한 700).

```bash
npm run build && pm2 restart ebook-maker   # 코드 갱신 후
pm2 logs ebook-maker
```

## 회원·관리자 (다른 프로젝트와 동일한 승인제)

- **회원가입**(이메일·이름·비밀번호·가입 메모, 약관 동의) → **승인 대기** 상태가 되고 로그인할 수 없다.
  `ADMIN_NOTIFY_EMAILS`로 승인 요청 메일이 간다(버튼 → `/admin?tab=users&status=pending`).
- **승인·거절 시 회원에게도 안내 메일**이 간다(거절 사유 포함). 승인하면 가입 크레딧(`SIGNUP_CREDITS`, 기본 500)을 한 번 지급한다.
- 메일은 `SMTP_*` 설정(Gmail 앱 비밀번호, 다른 프로젝트와 같은 계정)이 비어 있으면 건너뛰고, 실패해도 가입·승인은 성공한다.
- **관리자 계정**: 첫 기동 시 `.env`의 `ADMIN_EMAIL`/`ADMIN_PASSWORD`로 자동 생성(AI-TTS와 같은 계정). 이미 있으면 건드리지 않는다.
- **관리자 페이지** (`/admin`)
  - 대시보드: 승인 대기 수, 회원 수(상태별), 오늘 로그인·실패·가입, 전체 책 수, 최근 7일 가입·로그인·새 책
  - 회원 관리: 상태별 필터·검색, 승인 / 거절(사유 → 로그인 시·메일로 회원에게 표시) / 정지(즉시 로그아웃) / 해제,
    승인 대기 일괄 승인, 크레딧 지급·회수, 임시 비밀번호 발급(한 번만 표시), 회원별 로그인 기록·크레딧 내역·책
  - 책 목록: 전체 회원의 책 검색
  - 감사 로그: 가입·로그인 성공/실패/차단·비밀번호 변경·관리자 조치 전부 (IP 포함)
- **내 정보** (`/me`): 보유 크레딧과 내역, 비밀번호 변경(다른 기기 세션 종료)

**보안**

| 항목 | 내용 |
|---|---|
| 비밀번호 | scrypt 해시, 8자 이상 영문+숫자. 없는 계정도 같은 시간으로 검증(계정 존재 노출 방지) |
| 세션 | 랜덤 토큰(DB엔 SHA-256만 저장), `HttpOnly` · `SameSite=Strict` · HTTPS에서 `Secure`, 7일(`SESSION_DAYS`) |
| 로그인 잠금 | 이메일·IP별 5회 실패 시 15분 잠금 + IP별 분당 30회 |
| 가입 제한 | IP별 시간당 10회(`SIGNUP_LIMIT_PER_HOUR`) |
| CSRF | 상태 변경 API는 JSON만 허용 + `Origin` 호스트 검사 + SameSite=Strict |
| 리다이렉트 | 로그인 후 `next`는 같은 사이트 경로만 허용 |
| 프록시 | 앱은 루프백에만 바인딩, 클라이언트 IP는 Caddy가 넣는 `X-Forwarded-For` |

## API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 생존 확인 (공개) |
| POST | `/api/auth/signup` · `/login` · `/logout` | 가입 신청 / 로그인 / 로그아웃 |
| GET · PATCH | `/api/auth/me` · `/api/auth/password` | 내 정보·크레딧 / 비밀번호 변경 |
| GET | `/api/admin/stats` · `/users` · `/users/:id` · `/books` · `/audit` | 관리자 조회 |
| POST | `/api/admin/users/:id/{approve,reject,suspend,unsuspend,temp-password,credits}` · `/users/bulk-approve` | 관리자 조치 |

## 구조

| 경로 | 내용 |
|---|---|
| `apps/web` | Next.js — 대시보드, 로그인·가입, 관리자, 공개 뷰어 `/b/[slug]`, API(Route Handlers) |
| `apps/web/lib/server` | 인증·세션·요청 제한·메일·관리자 로직 (서버 전용) |
| `packages/schema` | Book/Page/Block 타입 + Zod 스키마 (SPEC 6.1) |
| `packages/layouts` | 슬롯 기반 레이아웃 정의, `placeBlocks` (SPEC 6.2) |
| `packages/renderer` | `PageRenderer` — 에디터·뷰어·PDF 공용 |
| `packages/db` | SQLite Store — 회원·세션·감사 로그·책·크레딧 원장 (SPEC 13 테이블 포함) |

## 알려진 한계 / 다음 단계

- **DB**: SPEC은 PostgreSQL이지만 서버 메모리 여유가 적어 다른 프로젝트처럼 SQLite로 시작했다. SQL은 옮기기 쉽게 표준에 가깝게 짰다.
- 요청 제한·로그인 잠금은 프로세스 메모리(재시작 시 초기화). 비밀번호 찾기·회원 탈퇴는 없다(관리자의 임시 비밀번호 발급으로 대응).
- 다음: 2주차 — 생성 위자드, AI 아웃라인 생성·편집, 예상 크레딧 표시.
