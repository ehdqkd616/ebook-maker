# ebook-maker

> 🔗 **배포 주소:** https://ebook-maker.hotgarlic.dedyn.io

원고 → 자동 조판 → 페이지 에디터 → 플립북 퍼블리시·PDF. 설계는 [ebook-generator-guide.md](ebook-generator-guide.md) 참고.
현재는 **AI 없이** 만드는 전자책 도구다 (FlipHTML5 흐름을 따르되, AI 아웃라인·레이아웃 대신 규칙 기반 조판).
AI 아웃라인·본문 생성은 같은 Book 문서를 채우는 단계로 나중에 붙인다.

## 기능

| 단계 | 내용 |
|---|---|
| **새 책 만들기** (`/books/new`) | ① 책 종류(전자책·가이드북·교재·브로슈어·카탈로그)·크기(A4·레터·정사각·가로) ② 테마 8종 ③ 제목·부제·지은이, 챕터별 요약·본문. `.txt`/`.md` 파일을 `# 제목` 줄마다 챕터로 가져오기. 오른쪽에서 조판 결과를 바로 미리보기 |
| **자동 조판** (`packages/layouts/compose.ts`) | 표지 → 목차 → 챕터 시작 → 본문 → 뒷표지. 본문은 가벼운 마크다운(빈 줄=문단, `## 소제목`, `- 목록`, `1. 목록`, `> 인용`, `![설명](주소)`)으로 나누고, 브라우저에서 **실제 웹폰트로 글자 폭을 재서** 슬롯을 넘치면 다음 쪽으로 넘긴다(문단은 문장 단위로 쪼갬, 소제목이 쪽 끝에 홀로 남지 않게). 목차 쪽 번호는 페이지 순서가 바뀔 때마다 자동 갱신 |
| **에디터** (`/books/:id/edit`) | 왼쪽 페이지 목록(끌어서 순서 바꾸기·복제·삭제·레이아웃 골라 추가) · 가운데 캔버스(선택·이동·8방향 크기 조절, 가장자리·가운데·다른 블록에 맞춤 안내선, 더블클릭으로 바로 글 고치기) · 오른쪽 속성(블록: 글·크기·색·정렬·굵게/기울임/밑줄·줄 간격·배경·위치·회전·투명도·앞/뒤 / 페이지: 레이아웃 10종 바꾸기·배경색·배경 이미지 / 책: 정보·크기·테마·색·글꼴). 블록 추가(제목·본문·목록·인용·이미지·도형·링크), 이미지 업로드, 되돌리기/다시 하기(100단계), 1.2초 자동 저장(버전 충돌 감지), 레이아웃을 바꿔 글이 넘치면 "넘친 글 다음 쪽으로 보내기" |
| **미리보기** (`/books/:id/preview`) | 편집 중인 책을 플립북으로 (본인만) |
| **퍼블리시·공유** | 공개본 스냅샷 → `/b/{slug}` 주소, QR 코드, 임베드 코드(`/embed/{slug}`). 다시 퍼블리시해야 공개본이 바뀐다. 공개 중지 가능 |
| **PDF·인쇄** (`/books/:id/print`) | 책 크기 그대로 `@page`를 맞춘 인쇄용 페이지 → 브라우저의 "PDF로 저장" |
| **플립북 뷰어** | 책장 넘김(page-flip), 처음/끝·이전/다음·방향키, 목차로 이동, 전체 화면 |

**에디터 단축키**: Ctrl+Z / Ctrl+Shift+Z(Ctrl+Y) 되돌리기·다시 · Delete 블록 삭제 · Ctrl+D 블록 복제 · Enter 글 고치기 · 방향키 1px(Shift 10px) 이동 · Alt+드래그 맞춤 끄기 · PageUp/PageDown 페이지 이동 · Ctrl+S 바로 저장

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

- **회원가입**(아이디·이름·비밀번호·가입 메모, 약관 동의) → **승인 대기** 상태가 되고 로그인할 수 없다.
  `ADMIN_NOTIFY_EMAILS`로 승인 요청 메일이 간다(버튼 → `/admin?tab=users&status=pending`).
- **승인·거절 시 회원에게도 안내 메일**이 간다(거절 사유 포함). 승인하면 가입 크레딧(`SIGNUP_CREDITS`, 기본 500)을 한 번 지급한다.
- 메일은 `SMTP_*` 설정(Gmail 앱 비밀번호, 다른 프로젝트와 같은 계정)이 비어 있으면 건너뛰고, 실패해도 가입·승인은 성공한다.
- **관리자 계정**: 아이디는 모든 프로젝트 공통으로 `admin`. 서버가 시작할 때마다 `.env`의 `ADMIN_PASSWORD`로 만들거나 비밀번호를 맞춘다.
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
| 로그인 잠금 | 아이디·IP별 5회 실패 시 15분 잠금 + IP별 분당 30회 |
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
| GET · POST | `/api/books` | 내 책 목록 / 새 책 저장 (`{ doc }` — 위자드가 조판한 Book) |
| GET · PATCH · DELETE | `/api/books/:id` | 불러오기 / 저장 (`{ doc, version }`, 버전이 다르면 409) / 삭제 |
| POST | `/api/books/:id/duplicate` | 사본 만들기 |
| POST · DELETE | `/api/books/:id/publish` | 퍼블리시(공개본 갱신) / 공개 중지 |
| POST | `/api/uploads` | 이미지 올리기 (`{ dataUrl }`, PNG·JPG·GIF·WEBP, 8MB, 회원별 시간당 120장) |
| GET | `/api/files/:name` | 올린 이미지 (공개, 무작위 이름) |

## 구조

| 경로 | 내용 |
|---|---|
| `apps/web` | Next.js — 대시보드, 새 책 위자드, 에디터(`components/editor`), 미리보기·인쇄, 로그인·가입, 관리자, 공개 뷰어 `/b/[slug]`·`/embed/[slug]`, API(Route Handlers) |
| `apps/web/lib/server` | 인증·세션·요청 제한·메일·관리자 로직 (서버 전용) |
| `packages/schema` | Book/Page/Block 타입 + Zod 스키마 (SPEC 6.1) |
| `packages/layouts` | 슬롯 기반 레이아웃 10종(`defs.ts`), 테마 프리셋(`themes.ts`), 규칙 기반 조판·목차·레이아웃 바꾸기(`compose.ts`) |
| `packages/renderer` | `PageRenderer` — 에디터·뷰어·PDF 공용 |
| `packages/db` | SQLite Store — 회원·세션·감사 로그·책·크레딧 원장 (SPEC 13 테이블 포함) |

## 알려진 한계 / 다음 단계

- **DB**: SPEC은 PostgreSQL이지만 서버 메모리 여유가 적어 다른 프로젝트처럼 SQLite로 시작했다. SQL은 옮기기 쉽게 표준에 가깝게 짰다.
- 요청 제한·로그인 잠금은 프로세스 메모리(재시작 시 초기화). 비밀번호 찾기·회원 탈퇴는 없다(관리자의 임시 비밀번호 발급으로 대응).
- 이미지는 `STORAGE_DIR/uploads`에 저장한다. 책을 지워도 올린 이미지 파일은 남는다(공개본·사본이 같은 파일을 쓸 수 있어서).
- PDF는 브라우저 인쇄 기능으로 만든다(서버 렌더링 없음). 인쇄 창에서 여백 없음·배경 그래픽을 켜야 디자인 그대로 나온다.
- 지금은 크레딧을 쓰지 않는다(AI 기능이 붙을 때 차감).
- 다음: AI 아웃라인·본문 생성(위자드 3단계 앞에 "주제로 초안 만들기"), PDF/DOCX 가져오기, EPUB 내보내기.
