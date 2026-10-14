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
| **템플릿** (`/books/new?start=template`) | 에세이·제품 카탈로그·회사 소개서·수업 교재·행사 안내·레시피북·포트폴리오 — 자동 조판에 상품 태그·연락처 받기 폼·버튼까지 얹은 예시 책 (`packages/layouts/src/templates.ts`) |
| **연락처 받기 폼** | 책 안에 "소식 받기·상담 신청" 버튼을 얹으면 독자가 이름·이메일·전화·메모를 보내고, 책 주인은 통계 화면에서 보고 CSV로 받는다 |
| **인터랙티브 요소** | 동영상(YouTube·Vimeo·직접 올린 MP4/WebM — 팝업 재생), 오디오, 사진 슬라이드쇼(자동 넘김·캡션), 상품 태그(사진·가격·설명·구매 링크 팝업), 버튼, 핫스팟(깜빡이는 점 또는 투명 영역), 웹 임베드(https iframe). **모든 블록에 클릭 동작**: 링크 열기 / 쪽으로 이동 / 팝업(제목·글·그림·동영상) |
| **애니메이션·꾸미기** | 블록별 등장 애니메이션 6종(페이드·위로·왼쪽·오른쪽·확대·튕김, 지연·길이 조절, 쪽을 펼칠 때 재생) · 테두리·모서리·그림자·이미지 필터 · 잠금/숨김 · 레이어 목록 · 블록 복사/붙여넣기(Ctrl+C/V) |
| **미리보기** (`/books/:id/preview`) | 편집 중인 책을 플립북으로 (본인만) |
| **플립북 뷰어** | 직접 만든 3D 책장 넘김(빛·그림자·책 두께, 끌어서 넘기기, 모서리 들림 힌트 — `components/viewer/BookStage.tsx`), **텍스트로 읽기** 모드(글자 크기·명조/고딕), 읽은 만큼 진행 막대, 넘김 방식 3가지(책장 넘김·슬라이드·세로 스크롤), 넘기는 소리, 배경 음악, 자동 넘김, 확대(최대 3배·끌어서 이동), 썸네일·목차·**본문 검색**(쪽별 강조)·책갈피, 마지막 읽은 쪽 이어 보기, 쪽 번호 입력 이동, 전체 화면, 키보드(←→ Home End + - F), 로고·배경색·배경 사진, 도구 막대 버튼 켜고 끄기 — 에디터 **뷰어** 탭에서 설정 |
| **퍼블리시·공유** | 공개본 스냅샷 → `/b/{slug}` 주소, QR 코드, 임베드 코드(`/embed/{slug}`), SNS 공유(Facebook·X·LINE·LinkedIn·메일), "지금 보는 쪽부터" 링크(`?page=`). **공개 범위**: 전체 공개(책장·검색엔진 노출) / 링크만 / 비밀번호 |
| **공개 책장** (`/u/{아이디}`) | 전체 공개한 책을 책장 모양으로 모아 보여 준다 |
| **열람 통계** (`/books/:id/stats`) | 조회수·방문자(하루 단위 익명 해시)·방문당 본 쪽수·클릭·모바일 비율, 날짜별 조회, 쪽별 열람, 많이 누른 요소, 유입 경로 (7/30/90일) |
| **PDF → 플립북** | 쪽 그대로 이미지로 바꾸면서 PDF 안의 **링크를 클릭 영역으로**, **북마크를 목차로**, 쪽마다의 **글을 검색용**으로 가져온다. **"글자 고칠 수 있게"** 방식은 글자를 뺀 배경 위에 같은 자리·크기·색·굵기·줄 간격의 글 블록을 올려 에디터에서 바로 고칠 수 있게 한다(줄 → 문단 묶기, 단 나눔 구분, 가짜 굵게·외곽선 글자 처리, 한글 줄바꿈 띄어쓰기 추정). 스캔본처럼 글자 정보가 없는 쪽은 그림 그대로 |
| **EPUB 내보내기** | 에디터의 EPUB 버튼 — 쪽 디자인 그대로의 EPUB 3 고정 레이아웃(그림 포함, 목차 = 뷰어 목차). 브라우저에서 만들어 내려받는다 |
| **PDF·인쇄** (`/books/:id/print`) | 책 크기 그대로 `@page`를 맞춘 인쇄용 페이지 → 브라우저의 "PDF로 저장". 공개본은 "PDF 저장·인쇄 허용"을 켜면 `/b/{slug}/print` 제공 |

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
| POST · PATCH · DELETE | `/api/books/:id/publish` | 퍼블리시(공개본 갱신) / 공개 범위·비밀번호(`{ visibility: public\|unlisted\|password, password? }`) / 공개 중지 |
| GET | `/api/books/:id/stats?days=30` | 열람 통계 (본인 책) |
| GET | `/api/books/:id/leads` (`?format=csv`) | 연락처 받기 폼으로 모은 내용 (본인 책) |
| POST | `/api/public/:slug/leads` | 독자가 폼 보내기 (`{ blockId, page, values }`, IP별 시간당 20건) |
| POST | `/api/track` | 뷰어 열람·쪽·클릭 기록 (공개, 요청 제한) |
| POST | `/api/public/:slug/unlock` | 비밀번호 책 열기 (`{ password }` → 30일 쿠키) |
| POST | `/api/uploads` | 이미지(PNG·JPG·GIF·WEBP 8MB)·오디오(MP3·M4A·OGG·WAV)·동영상(MP4·WebM) 30MB 올리기 (`{ dataUrl }`, 회원별 시간당 600개) |
| GET | `/api/files/:name` | 올린 파일 (공개, 무작위 이름, Range 지원) |

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
- EPUB은 고정 레이아웃이라 글자 크기를 바꿔 다시 흘리는 리플로 뷰어(킨들 기본 등)에서는 쪽 그림처럼 보인다. 동영상·폼 등 인터랙티브 요소는 EPUB에서 모양만 남는다.
- 다음: AI 아웃라인·본문 생성(위자드 3단계 앞에 "주제로 초안 만들기"), 리플로 EPUB, 사용자 지정 도메인.
