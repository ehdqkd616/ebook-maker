# AI 전자책 생성기 개발 지침서

> FlipHTML5 AI Ebook Generator 같은 "주제/파일 → AI 아웃라인 → AI 레이아웃 → 편집 → 플립북 퍼블리시" 도구를 직접 만들기 위한 설계·개발 가이드
> 작성일: 2026-10-12

---

## 0. 이 문서를 읽기 전에

- **2장(레퍼런스 분석)** 은 공식 가이드·보도자료에서 **확인한 사실**만 적었습니다.
- **3장 이후(설계)** 는 그 사실을 바탕으로 한 **제안**이에요. FlipHTML5의 내부 구현(어떤 모델·엔진을 쓰는지)은 공개되어 있지 않으므로, 아키텍처는 "이렇게 만들면 같은 결과를 낼 수 있다"는 설계안이지 "FlipHTML5가 이렇게 만들었다"는 뜻이 아닙니다.
- 참고: 요청하신 help.fliphtml5.com 한국어 문서는 자동 접근이 차단되어 직접 읽지 못했고, 대신 그 문서를 출처로 인용한 FlipHTML5 공식 단계별 가이드(fliphtml5.com/guide)를 분석했습니다.
- 라이브러리 이름은 2026년 10월 기준 알려진 것들이고, **설치 전 npm/GitHub에서 최신 버전과 유지보수 상태를 꼭 확인**하세요.
- 이 문서는 Claude Code 같은 코딩 에이전트에 그대로 "스펙"으로 넘겨도 되도록 구성했습니다 (17장 참고).

---

## 1. 만들 제품 한 줄 정의

**"주제 한 줄 또는 PDF/Word 파일을 넣으면, AI가 목차를 짜고 → 사용자가 목차를 고치고 → AI가 디자인된 여러 페이지 전자책으로 렌더링하고 → 웹 에디터에서 다듬어 → 책장 넘기는 플립북 URL로 공유하거나 PDF/EPUB으로 내보내는 웹 서비스"**

---

## 2. 레퍼런스 분석

### 2.1 FlipHTML5 AI Ebook Generator (확인된 사실)

출처: FlipHTML5 공식 가이드 "Step-by-Step Guide to Creating an Ebook with AI"(2026-02-09) 및 보도자료

**전체 흐름: 6단계**
| 단계 | 내용 |
|---|---|
| 1. 생성기 열기 | 전용 페이지 또는 대시보드 Upload → Create with AI. 좌측에 설정 패널 |
| 2. 설정 | 책 종류(28종: Ebook, Guidebook, Textbook, Brochure, Catalog, Newsletter, Magazine, Lookbook, Cookbook 등), 콘텐츠 소스(파일 업로드), 언어(29개) |
| 3. 콘텐츠 입력 | A) 주제 텍스트 입력 — 제목, 챕터, 대상 독자, 문체(formal/academic/friendly/professional/conversational/narrative), 톤(inspiring/neutral/humorous/authoritative/casual) 지정 가능<br>B) PDF/Word 업로드 — 최대 50MB, 50페이지 |
| 4. 아웃라인 검토 | 챕터 제목 + 내용 요약의 계층 뷰. 제목 더블클릭 인라인 편집, "Edit Outline Content"로 본문 재작성·추가·삭제·순서 변경. **아웃라인 단어 수와 소모될 AI 포인트를 미리 표시** |
| 5. AI 레이아웃 | "Start AI Layout" → 톤·대상 분석 → 템플릿 라이브러리에서 매칭 → 제목·본문·이미지·장식 요소 배치. 수 분 소요, **백그라운드 처리 후 알림** |
| 6. 편집·퍼블리시 | 페이지 에디터(텍스트·이미지·폰트·색·페이지 추가/삭제·멀티미디어), AI 어시스턴트(문장 다듬기·번역·텍스트→이미지). 원클릭 퍼블리시 → 고유 URL, QR코드, 임베드 코드, SNS 공유, 커스텀 도메인. Stripe 기반 유료 판매(무료 미리보기 페이지 수 설정) |

**그 밖의 확인된 사실**
- 책 크기 프리셋: A4(794×1123px), Letter(816×1056px), Flyer(416×865px), Booklet(793×793px), Presentation(1123×794px) 등 6종
- 설정에 메인 색상, 책 언어 포함. 아웃라인 승인 후 레이아웃 템플릿과 테마 색상을 고름
- 과금: 무료 계정 월 500 AI 포인트. **아웃라인 100단어당 200포인트**, 100단어 단위 올림
- 브랜딩(로고·색·폰트), 책 안에 넣는 AI PDF 챗봇, 열람 통계 기능 존재
- 같은 엔진으로 매거진·카탈로그·브로슈어·스토리북 등 파생 생성기 운영

**핵심 설계 포인트 (분석)**
1. **2단계 생성(아웃라인 → 레이아웃)** 이 핵심이에요. 비싼 레이아웃 생성 전에 사용자가 싼 텍스트 단계에서 방향을 잡게 해서 실패 비용을 줄입니다.
2. **비용 투명성**: 레이아웃 전에 소모 크레딧을 보여줌.
3. **비동기 작업**: 렌더링은 큐에서 돌고, 끝나면 알림.
4. **"책 종류"가 곧 템플릿 세트**: 종류를 고르면 레이아웃 규칙이 바뀜 → 하나의 엔진으로 여러 상품 가능.

### 2.2 Visual Paradigm AI Flipbook Maker
- 주제 + **대상 독자**(일반 독자, 엔지니어 등) + **톤**(격식, 유머 등) + **페이지 수** 입력 → 구조화된 아웃라인
- 본문·표지용 AI 이미지 생성 내장
- 독자에 맞춰 깊이·전문용어·예시를 조절
- 용지 크기·방향 설정, 여러 책을 모아두는 **책장(bookshelf)** 기능

### 2.3 Designrr
- 블로그 URL, Word/Google Docs, PDF, 오디오·영상(YouTube 포함) → 전자책으로 **재가공(repurposing)**. 오디오/영상은 자동 전사
- 질문 몇 개에 답하면 사용자 목소리를 반영한 아웃라인·본문 생성(WordGenie)
- 수백 개 템플릿, 3D 표지 생성, 자동 목차·페이지 번호·머리글/바닥글
- 내보내기: **PDF, ePub, Kindle, HTML 임베드, 플립북**
- 리뷰상 불만: 핵심 내보내기(ePub/Kindle)가 상위 요금제에 묶여 있음, AI 크레딧 제한

### 2.4 공통 패턴 → 우리 제품의 필수 요소
| 요소 | 3사 공통 여부 | 우리 MVP |
|---|---|---|
| 주제 프롬프트 입력 | ✅ | 필수 |
| 파일(PDF/DOCX) 업로드 | ✅ | 필수 |
| 편집 가능한 아웃라인 단계 | ✅ | 필수 |
| 대상 독자·톤·언어 옵션 | ✅ | 필수 |
| 템플릿 기반 자동 레이아웃 | ✅ | 필수 |
| AI 이미지 생성 | ✅ | 2차 |
| 웹 에디터 | ✅ | 필수(간단 버전) |
| 플립북 뷰어 + URL 공유 | ✅ | 필수 |
| PDF 내보내기 | ✅ | 필수 |
| EPUB/Kindle | Designrr | 2차 |
| 판매·결제 | FlipHTML5 | 3차 |

### 2.5 차별화 아이디어 (제안)
- **한국어 특화**: 한글 조판(줄바꿈 `word-break: keep-all`, 한글 웹폰트, 세로 리듬) 품질을 경쟁사보다 높이기
- **교육 콘텐츠 특화**: 음악 전자교과서 같은 분야 — 퀴즈, 오디오 재생 블록, 악보 이미지 블록 등 인터랙티브 블록
- **EPUB을 기본 요금제에 포함** (Designrr 불만 지점 공략)
- **챕터 단위 재생성**: 전체를 다시 만들지 않고 특정 챕터/페이지만 다시 생성

---

## 3. 기능 범위와 로드맵

### MVP (v0.1)
1. 회원가입/로그인 (이메일 + 소셜 1개)
2. 생성 위자드: 책 종류(5종으로 시작), 크기(A4/정사각/가로), 언어, 대상 독자, 문체, 톤, 페이지 수, 테마 색
3. 입력: 주제 텍스트 / PDF·DOCX 업로드
4. 아웃라인 생성 → 편집(제목 수정, 챕터 추가·삭제·순서 변경, 요약 수정) → 예상 크레딧 표시
5. 본문 생성 + 레이아웃 생성 (백그라운드 작업, 진행률 표시)
6. 간단 에디터: 텍스트 수정, 이미지 교체, 페이지 추가/삭제, 테마 색 변경
7. 플립북 뷰어 + 공개 URL + QR + iframe 임베드 코드
8. PDF 내보내기
9. 크레딧 차감 로직

### v0.2
- AI 이미지 생성(표지·삽화), 챕터 단위 재생성, AI 문장 다듬기/번역
- EPUB 내보내기, 책장(내 책 목록 공개 페이지)
- 템플릿/책 종류 확장

### v0.3
- 결제(토스페이먼츠/Stripe) 및 크레딧 충전, 유료 판매 + 미리보기 페이지 제한
- 열람 통계, 오디오/영상/퀴즈 블록, 커스텀 도메인, 팀 기능

---

## 4. 사용자 흐름 (화면 단위)

```
[대시보드] → [새 책 만들기 위자드]
   ├─ Step1 설정: 책 종류 / 크기 / 언어 / 테마색
   ├─ Step2 입력: (탭) 주제 입력 | 파일 업로드
   │          + 대상 독자 / 문체 / 톤 / 목표 페이지 수
   └─ [아웃라인 생성] 버튼
[아웃라인 편집 화면]
   ├─ 챕터 트리 (드래그로 순서 변경, 더블클릭 제목 수정)
   ├─ 챕터별 요약/핵심 포인트 편집
   ├─ 하단: "총 N단어 · 예상 M크레딧" + [다시 생성] [레이아웃 시작]
[생성 진행 화면] → 진행률 바 (본문 작성 → 페이지 배치 → 이미지 → 썸네일)
   └─ "나가도 됩니다. 완료되면 알려드릴게요"
[에디터] ← 완료 알림
   ├─ 좌: 페이지 썸네일 목록 / 중앙: 캔버스 / 우: 속성 패널
   └─ 상단: [미리보기(플립)] [퍼블리시] [내보내기 PDF]
[공유 모달] URL 복사 / QR 다운로드 / 임베드 코드 / SNS
[공개 뷰어 /b/{slug}] 플립북
```

---

## 5. 시스템 아키텍처 (제안)

경력 스택(Node.js, React/React Native, MS-SQL·MySQL)과 맞추어 **전부 TypeScript/Node 기반**으로 제안합니다.

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────┐
│ Next.js (웹)  │◄───►│ API 서버 (Node)   │◄───►│ PostgreSQL/   │
│ 위자드·에디터 │     │ Next.js Route 또는│     │ MySQL         │
│ 뷰어          │     │ NestJS/Fastify    │     └───────────────┘
└──────┬───────┘     └────────┬─────────┘
       │                      │ enqueue
       │              ┌───────▼────────┐     ┌───────────────┐
       │              │ Redis + BullMQ │────►│ Worker (Node) │
       │              └────────────────┘     │ - LLM 호출     │
       │                                     │ - 이미지 생성  │
       │                                     │ - 페이지네이션 │
       │                                     │ - PDF(Playwright)│
       │                                     └──────┬────────┘
       │                                            │
       └──────────────► S3/R2 (이미지·PDF·썸네일) ◄──┘
```

| 레이어 | 추천 | 이유 |
|---|---|---|
| 프론트 | Next.js(App Router) + React + Tailwind | SSR로 공개 뷰어 SEO/OG 태그 처리 |
| 상태관리 | Zustand + Immer (에디터), TanStack Query (서버) | 에디터 undo/redo 구현 쉬움 |
| API | Next.js Route Handlers로 시작 → 커지면 분리 | 초기 1인 개발 부담↓ |
| DB | PostgreSQL(JSONB 활용) 또는 MySQL 8(JSON 타입) | 책 콘텐츠를 JSON 문서로 저장 |
| ORM | Prisma 또는 Drizzle | |
| 큐 | Redis + BullMQ | 수 분 걸리는 생성 작업 비동기 처리, 진행률 보고 |
| 실시간 진행률 | SSE 또는 폴링 | 웹소켓까지는 불필요 |
| LLM | Claude / OpenAI 등 API (구조화 출력 지원 모델) | JSON 스키마 강제 출력 필요 |
| 스키마 검증 | Zod | LLM 출력 검증·재시도 |
| 이미지 생성 | 이미지 생성 API (v0.2) | |
| 스토리지 | S3 또는 Cloudflare R2 | |
| PDF 렌더 | Playwright(헤드리스 Chromium) `page.pdf()` | 뷰어와 동일 HTML로 PDF 생성 → 결과 일치 |
| 플립 효과 | StPageFlip(`page-flip`) | HTML 요소/이미지 둘 다 페이지로 사용 가능, 모바일 터치·세로/가로 모드·하드커버 지원 |

---

## 6. 데이터 모델 — 가장 중요한 부분

모든 기능(에디터, 뷰어, PDF, EPUB)이 **하나의 Book JSON**을 읽어서 렌더링하게 만드는 게 핵심이에요. 렌더러만 여러 개 두면 됩니다.

### 6.1 Book 문서 스키마 (TypeScript)

```ts
type Book = {
  id: string;
  title: string;
  subtitle?: string;
  language: string;          // "ko", "en" ...
  bookType: BookType;        // "ebook" | "guidebook" | "textbook" | "brochure" | "catalog" ...
  size: { preset: "A4" | "LETTER" | "SQUARE" | "LANDSCAPE"; width: number; height: number }; // px
  theme: Theme;
  outline: Outline;          // 아웃라인 단계 산출물 (재생성·재배치용으로 보존)
  pages: Page[];
  meta: { audience?: string; style?: string; tone?: string; targetPages?: number };
};

type Theme = {
  templateId: string;        // 템플릿 세트 ID
  primary: string; secondary: string; background: string; text: string;
  headingFont: string; bodyFont: string;
};

type Outline = {
  chapters: {
    id: string;
    title: string;
    summary: string;
    keyPoints: string[];
    content?: string;        // 본문 생성 후 채워짐 (Markdown)
  }[];
};

type Page = {
  id: string;
  layoutId: LayoutId;        // "cover" | "toc" | "chapter-opener" | "text-1col" | "text-image-right" ...
  chapterId?: string;
  background?: { color?: string; imageUrl?: string };
  blocks: Block[];
};

type Block = {
  id: string;
  slot?: string;             // 레이아웃 슬롯 이름 (자동 배치 시)
  type: "heading" | "paragraph" | "list" | "quote" | "image" | "shape" | "audio" | "video" | "link";
  x: number; y: number; w: number; h: number;   // 페이지 기준 px (에디터에서 자유 이동)
  rotation?: number;
  style?: Record<string, string | number>;
  data: any;                 // type별 내용 (text, src, items, href ...)
};
```

### 6.2 레이아웃(템플릿) 정의
레이아웃 = **슬롯이 정해진 페이지 틀**. AI는 "어떤 레이아웃에 어떤 내용을 넣을지"만 고르고, 좌표는 템플릿이 정합니다. AI에게 좌표를 직접 만들게 하면 결과가 불안정하기 때문이에요.

```ts
type LayoutDef = {
  id: LayoutId;
  name: string;
  slots: {
    name: string;                       // "title", "body", "image", "caption"
    accepts: Block["type"][];
    box: { x: number; y: number; w: number; h: number }; // 0~1 비율 좌표 → 크기 프리셋마다 재계산
    maxChars?: number;                  // 넘치면 다음 페이지로
  }[];
};
```

**MVP 레이아웃 10종 추천**: cover, toc, chapter-opener, text-1col, text-2col, text-image-right, text-image-left, image-full-caption, quote, back-cover

**템플릿 세트** = 책 종류별로 위 레이아웃의 스타일(폰트·장식·여백)을 묶은 것. 예: `ebook-modern`, `guidebook-clean`, `catalog-grid`.

---

## 7. AI 생성 파이프라인

```
입력(주제 or 파일 텍스트)
  └─▶ ① 아웃라인 생성 (LLM, JSON)  ── 사용자 편집 ──┐
                                                   ▼
      ② 챕터 본문 생성 (LLM, 챕터별 병렬, Markdown)
      ③ 블록화 (Markdown → 블록 리스트, 코드로 처리)
      ④ 레이아웃 계획 (LLM, 블록 묶음 → layoutId 지정, JSON)
      ⑤ 페이지네이션 (코드: 넘치는 텍스트 측정·분할)
      ⑥ 이미지 생성/선택 (v0.2)
      ⑦ 썸네일·검증 → 완료 알림
```

### ① 아웃라인 생성 프롬프트 예시

```
시스템: 너는 전자책 기획 편집자다. 반드시 지정된 JSON 스키마로만 답한다.

사용자:
- 책 종류: {bookType}
- 주제/요청: {prompt}
- 언어: {language}
- 대상 독자: {audience}
- 문체: {style}, 톤: {tone}
- 목표 분량: 약 {targetPages}페이지 (본문 1페이지 ≈ {charsPerPage}자)

요구사항:
1. 표지·목차를 제외하고 {chapterCount}개 내외의 챕터를 만든다.
2. 각 챕터에 title, summary(2~3문장), keyPoints(3~5개)를 넣는다.
3. 챕터 순서는 독자가 따라가기 쉬운 논리 순서로 한다.
4. 책 제목(title)과 부제(subtitle)를 제안한다.

출력 스키마: { "title": string, "subtitle": string, "chapters": [{ "title": string, "summary": string, "keyPoints": string[] }] }
```

- 출력은 **Zod로 검증**, 실패 시 오류 메시지를 붙여 1~2회 재시도
- 챕터 수 = 목표 페이지 수 ÷ (챕터당 평균 페이지)로 코드에서 계산해 넣기

### ② 챕터 본문 생성
- 챕터마다 별도 호출, **병렬 처리**(동시성 3~5 제한)
- 프롬프트에 전체 아웃라인 + 현재 챕터 + 앞 챕터 요약을 넣어 일관성 유지
- 챕터별 목표 글자 수 지정 (예: 챕터 페이지 수 × 페이지당 글자 수)
- 출력은 Markdown (`##`, 문단, 목록, 인용) — 블록 변환이 쉬움
- 이미지가 들어갈 자리는 `[[IMAGE: 설명]]` 같은 마커로 받게 하면 ⑥에서 활용 가능

### ③ 블록화
- `remark`/`marked` 같은 Markdown 파서로 AST → `heading/paragraph/list/quote/image` 블록 배열로 변환 (LLM 불필요)

### ④ 레이아웃 계획
LLM에게 블록 묶음과 사용 가능한 레이아웃 목록을 주고 페이지 계획을 받습니다.

```
사용 가능한 레이아웃: [{id, 설명, 슬롯, 슬롯별 최대 글자 수}...]
챕터 블록: [...]
규칙:
- 챕터 시작은 chapter-opener
- 같은 레이아웃이 3번 연속되지 않게 변화를 준다
- 이미지 마커가 있으면 이미지 슬롯이 있는 레이아웃 사용
출력: { "pages": [{ "layoutId": string, "slots": { "<slotName>": [blockId...] } }] }
```

※ 비용을 줄이려면 ④를 LLM 없이 **규칙 기반**으로 먼저 만들고(예: 문단 N개마다 이미지 레이아웃 끼우기), 품질이 아쉬울 때 LLM으로 바꾸는 방법도 있어요.

### ⑤ 페이지네이션 (넘침 처리) — 실제로 가장 까다로운 부분
글자 수 추정만으로는 폰트·줄바꿈 때문에 정확하지 않으므로 **실제 렌더링해서 측정**합니다.

방법 (워커에서 Playwright 사용):
1. 페이지 HTML을 실제 크기·폰트로 렌더
2. 각 텍스트 슬롯에서 `scrollHeight > clientHeight` 인지 검사
3. 넘치면 문단 단위로 뒤에서부터 잘라 다음 페이지(같은 레이아웃 or `text-1col`)로 이동
4. 문단 하나가 슬롯보다 크면 문장 단위로 분할
5. 모든 페이지가 안 넘칠 때까지 반복

한국어 처리: `word-break: keep-all; line-break: strict;` 적용, 한글 웹폰트(예: Pretendard, Noto Sans KR — 둘 다 OFL 라이선스로 알려져 있으나 사용 전 확인)를 워커에도 설치해야 측정이 일치합니다.

### ⑥ 이미지 (v0.2)
- 표지: 제목·주제·테마색 기반 프롬프트로 생성
- 본문: `[[IMAGE: ...]]` 마커 설명으로 생성 또는 무료 스톡 API 검색
- 생성 이미지 저장 후 블록 `data.src`에 URL

### ⑦ 작업(Job) 설계
```ts
// BullMQ job: "generate-book"
// 단계마다 job.updateProgress({ stage: "content", done: 3, total: 8 })
// 실패 시 단계별 재시작 가능하도록 중간 산출물을 DB에 저장
```

### 파일 업로드 입력 처리
| 형식 | 추출 방법(제안) |
|---|---|
| PDF | `pdfjs-dist` 또는 `pdf-parse`로 텍스트 추출 (스캔본은 OCR 필요 — MVP에선 미지원 안내) |
| DOCX | `mammoth`로 HTML/텍스트 추출 (제목 스타일 → 챕터 후보) |
| 제한 | FlipHTML5처럼 용량·페이지 상한(예: 50MB/50페이지) 설정 |

추출 텍스트가 길면 청크로 나눠 요약 → 그 요약을 바탕으로 ① 아웃라인 생성 ("원문 내용을 최대한 보존하라"는 지시 추가).

---

## 8. 에디터

### 구현 방식 선택
| 방식 | 장점 | 단점 |
|---|---|---|
| **DOM 기반 (절대 위치 div)** ← 추천 | 뷰어/PDF와 같은 HTML 재사용, 텍스트 편집·한글 IME 자연스러움 | 회전·스냅 등 직접 구현 |
| Canvas(Fabric.js/Konva) | 도형·회전·스냅 쉬움 | 텍스트 편집·한글 입력·PDF 일치가 어려움 |

DOM 방식 구성:
- 이동/크기조절: `react-moveable` 또는 `react-rnd` 계열 라이브러리
- 텍스트 편집: 블록 더블클릭 시 `contentEditable` 또는 Tiptap 인라인 에디터
- 상태: Book JSON을 Zustand에 두고, 변경은 Immer patch로 기록 → undo/redo
- 저장: 디바운스 자동저장(2~3초), 서버에는 `version` 필드로 낙관적 잠금

### MVP 에디터 기능 체크리스트
- [ ] 페이지 썸네일 목록 (추가/삭제/복제/순서 변경)
- [ ] 블록 선택·이동·크기 조절
- [ ] 텍스트 편집 (굵게/기울임/정렬/크기/색)
- [ ] 이미지 업로드·교체
- [ ] 테마 색·폰트 전체 변경
- [ ] 페이지 레이아웃 변경 (같은 내용, 다른 레이아웃 적용)
- [ ] undo/redo, 자동저장
- [ ] (v0.2) 선택 텍스트 AI 다듬기/번역, 이 페이지만 다시 생성

---

## 9. 뷰어 (플립북)

```html
<div id="book">
  <div class="page" data-density="hard">표지</div>
  <div class="page">...</div>
  <div class="page" data-density="hard">뒷표지</div>
</div>
<script type="module">
  import { PageFlip } from "page-flip";
  const pf = new PageFlip(document.getElementById("book"), {
    width: 794, height: 1123,   // 책 크기 프리셋
    size: "stretch", showCover: true, mobileScrollSupport: false,
  });
  pf.loadFromHTML(document.querySelectorAll(".page"));
  pf.on("flip", (e) => trackPageView(e.data));
</script>
```
- 공통 `PageRenderer` 컴포넌트가 Page JSON → HTML 생성 (에디터·뷰어·PDF 공용)
- 페이지가 많으면 **이미지 모드**(퍼블리시 시 페이지별 PNG/WebP 미리 렌더)로 바꿔 성능 확보 — `loadFromImages` 사용
- 툴바: 이전/다음, 페이지 번호, 목차 이동, 전체화면, 확대, 공유
- 옵션(제안): StPageFlip의 원본 저장소 유지보수가 활발하지 않을 수 있어(추측, 확인 필요) 포크 버전들이 존재합니다. 설치 전 이슈·최근 커밋을 확인하세요.

---

## 10. 퍼블리시·공유

- 퍼블리시 시 `published_snapshot`(Book JSON 복사본) 저장 → 이후 편집해도 공개본은 다시 퍼블리시할 때만 바뀜
- URL: `/b/{slug}` (slug는 nanoid 8~10자)
- **OG 태그**: 제목, 설명, 표지 썸네일 → 카카오톡·SNS 미리보기
- **QR**: `qrcode` 패키지로 PNG/SVG 생성
- **임베드**: `<iframe src="https://도메인/embed/{slug}" width="100%" height="600" allowfullscreen></iframe>`
- 공개 범위: 공개 / 링크가 있는 사람만 / 비밀번호
- (v0.3) 열람 통계: 페이지 flip 이벤트 수집 → 조회수·평균 열람 페이지

---

## 11. 내보내기

| 형식 | 방법(제안) | 메모 |
|---|---|---|
| PDF | Playwright로 `/render/{bookId}` 인쇄용 페이지 열고 `page.pdf({ width, height, printBackground: true })` | CSS `@page { size: 794px 1123px; margin: 0 }`, 각 페이지 `break-after: page` |
| 이미지(PNG) | Playwright 페이지별 스크린샷 | 썸네일·이미지 모드 뷰어에 재사용 |
| EPUB (v0.2) | **리플로우형**: Outline의 챕터 Markdown → XHTML 챕터로 변환 후 EPUB 패키징 (`epub-gen-memory` 같은 라이브러리 또는 직접 zip) | 고정 레이아웃 디자인은 EPUB에서 그대로 유지되지 않음 — 본문 중심 출력이라고 안내 |
| HTML 임베드 | 10장 iframe | |

---

## 12. 크레딧·과금 설계

참고 기준(FlipHTML5): 레이아웃 생성 시 아웃라인 100단어당 200포인트, 무료 월 500포인트.

제안:
- 원가 기준으로 설계: (입력+출력 토큰 비용) + 이미지 생성 비용 + 렌더링 비용 → 마진 곱해 크레딧 환산
- 한국어는 "단어"보다 **글자 수 기준**이 직관적 (예: 1,000자당 N크레딧)
- 레이아웃 시작 전 **예상 크레딧 표시 → 확인 후 차감**
- 크레딧은 `credit_ledger`(원장) 테이블에 +/− 기록으로만 관리 (잔액 컬럼 직접 수정 금지) → 실패 작업은 자동 환불 기록
- 무료 플랜: 월 크레딧 + 워터마크 + 공개 URL만, 유료: PDF/EPUB·워터마크 제거·커스텀 도메인

---

## 13. DB 스키마 (PostgreSQL 예시)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT,
  plan TEXT NOT NULL DEFAULT 'free', created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE books (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL,          -- draft_outline | generating | ready | failed
  doc JSONB NOT NULL,            -- Book JSON (6장)
  version INT NOT NULL DEFAULT 1,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE publications (
  id UUID PRIMARY KEY,
  book_id UUID REFERENCES books(id),
  slug TEXT UNIQUE NOT NULL,
  visibility TEXT NOT NULL,      -- public | unlisted | password
  password_hash TEXT,
  snapshot JSONB NOT NULL,
  published_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assets (
  id UUID PRIMARY KEY, user_id UUID, book_id UUID,
  kind TEXT,                     -- upload | ai_image | thumbnail | pdf | epub
  url TEXT NOT NULL, bytes INT, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs (
  id UUID PRIMARY KEY, book_id UUID, type TEXT,   -- outline | generate | export_pdf ...
  status TEXT, progress JSONB, error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(), finished_at TIMESTAMPTZ
);

CREATE TABLE credit_ledger (
  id BIGSERIAL PRIMARY KEY, user_id UUID, delta INT NOT NULL,
  reason TEXT,                   -- monthly_grant | generate | refund | purchase
  job_id UUID, created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE page_views (        -- v0.3
  id BIGSERIAL PRIMARY KEY, publication_id UUID, page_no INT,
  session_id TEXT, viewed_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 14. API 명세 (요약)

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/uploads` | 파일 업로드 → 텍스트 추출 → `{ uploadId, charCount }` |
| POST | `/api/books` | 설정+입력으로 책 생성 및 아웃라인 작업 시작 → `{ bookId, jobId }` |
| GET | `/api/books/:id` | Book JSON 조회 |
| PATCH | `/api/books/:id` | 편집 저장 (`version` 포함, 충돌 시 409) |
| PUT | `/api/books/:id/outline` | 아웃라인 수정 |
| POST | `/api/books/:id/outline/regenerate` | 아웃라인 재생성 |
| GET | `/api/books/:id/estimate` | 예상 크레딧 |
| POST | `/api/books/:id/generate` | 본문+레이아웃 생성 시작 (크레딧 차감) |
| POST | `/api/books/:id/pages/:pageId/regenerate` | 페이지 재생성 (v0.2) |
| GET | `/api/jobs/:id` / `/api/jobs/:id/stream` | 진행률 폴링 / SSE |
| POST | `/api/books/:id/publish` | 퍼블리시 → `{ slug, url, qrUrl, embedCode }` |
| POST | `/api/books/:id/export` | `{ format: "pdf" | "epub" }` → jobId |
| POST | `/api/ai/rewrite` | 선택 텍스트 다듬기/번역 (v0.2) |
| GET | `/api/me/credits` | 잔액(원장 합계) |

---

## 15. 폴더 구조 (모노레포 제안)

```
ebook-maker/
├─ apps/
│  ├─ web/                 # Next.js: 위자드, 에디터, 뷰어, API routes
│  │  ├─ app/(dashboard)/  app/editor/[id]/  app/b/[slug]/  app/embed/[slug]/
│  │  └─ app/render/[id]/  # PDF·썸네일용 인쇄 페이지 (내부 전용)
│  └─ worker/              # BullMQ 워커: AI 파이프라인, Playwright
├─ packages/
│  ├─ schema/              # Book/Page/Block 타입 + Zod 스키마 (공용)
│  ├─ renderer/            # PageRenderer (React) — 에디터·뷰어·PDF 공용
│  ├─ layouts/             # LayoutDef + 템플릿 세트 + CSS
│  ├─ ai/                  # 프롬프트, LLM 클라이언트, 재시도/검증
│  └─ db/                  # Prisma/Drizzle 스키마
└─ docker-compose.yml      # postgres, redis
```

---

## 16. 개발 순서 체크리스트

**1주차 — 뼈대와 데이터 모델**
- [ ] 모노레포, DB, Redis, 인증
- [ ] `packages/schema` Book 타입·Zod 확정
- [ ] 레이아웃 3종(cover, chapter-opener, text-1col) + `PageRenderer`
- [ ] 하드코딩 Book JSON으로 뷰어(page-flip) 띄우기 ← **여기서 결과물이 눈에 보여야 동기부여 유지**

**2주차 — AI 아웃라인**
- [ ] 위자드 UI, 아웃라인 프롬프트·Zod 검증·재시도
- [ ] 아웃라인 편집 화면 (드래그 정렬, 인라인 수정)
- [ ] 예상 크레딧 계산

**3주차 — 본문·레이아웃 생성**
- [ ] BullMQ 워커, 진행률 SSE
- [ ] 챕터 본문 병렬 생성 → 블록화 → 규칙 기반 레이아웃
- [ ] Playwright 페이지네이션(넘침 분할), 한글 폰트 설치
- [ ] 레이아웃 10종으로 확장

**4주차 — 에디터**
- [ ] 블록 선택/이동/크기, 텍스트 편집, 이미지 교체
- [ ] 페이지 관리, 테마 변경, undo/redo, 자동저장

**5주차 — 퍼블리시·내보내기·업로드**
- [ ] 퍼블리시 스냅샷, slug URL, OG, QR, 임베드
- [ ] PDF 내보내기
- [ ] PDF/DOCX 업로드 → 아웃라인

**6주차 — 다듬기**
- [ ] 크레딧 원장, 실패 환불, 무료 플랜 제한
- [ ] 에러 처리, 로딩 UX, 모바일 뷰어 점검
- [ ] 생성 품질 튜닝 (프롬프트·레이아웃 다양성)

(주차는 1인 개발 기준의 대략적인 목표이고, 실제 속도는 상황에 따라 다를 수 있어요.)

---

## 17. Claude Code 등 코딩 에이전트에게 맡길 때

이 파일을 프로젝트 루트에 `SPEC.md`로 두고, 단계별로 요청하는 것이 효과적이에요.

예시 요청:
1. "SPEC.md의 15장 구조로 모노레포를 만들고, 6장 스키마를 `packages/schema`에 Zod로 구현해줘."
2. "6.2장 방식으로 레이아웃 3종과 PageRenderer를 만들고, 샘플 Book JSON을 9장 page-flip 뷰어로 보여주는 페이지를 만들어줘."
3. "7장 ① 아웃라인 생성 API와 편집 화면을 구현해줘. LLM 응답은 Zod 검증 후 2회까지 재시도."
4. 이후 16장 체크리스트 순서대로 진행

팁: 한 번에 전체를 시키지 말고 **주차 단위**로, 각 단계 끝에 "실행해서 화면 확인"을 넣으세요.

---

## 18. 주의사항

- **템플릿·디자인 복제 금지**: 경쟁사 템플릿이나 디자인을 그대로 베끼지 말고 직접 만든 템플릿을 쓰세요. 기능 흐름(아웃라인→레이아웃) 자체는 일반적인 방식이에요.
- **폰트 라이선스**: 웹 임베드·PDF 임베드가 허용되는 폰트만 사용 (OFL 등). 상업용 폰트는 임베딩 조건 확인.
- **AI 생성물 고지·책임**: 사실 오류 가능성 안내, 이용약관에 생성물 저작권·책임 범위 명시.
- **업로드 파일 저작권**: 사용자가 권리 있는 파일만 업로드하도록 약관 명시, 신고 처리 절차 마련.
- **비용 폭주 방지**: 사용자별 동시 작업 수·일일 생성 횟수 제한, LLM 호출 타임아웃.
- **개인정보**: 업로드 원본 보관 기간 정책, 삭제 기능.
- **Playwright 리소스**: 헤드리스 브라우저는 메모리를 많이 써서 워커 동시성 조절 필요.

---

## 19. 출처

- FlipHTML5, Step-by-Step Guide to Creating an Ebook with AI (2026-02-09): https://fliphtml5.com/guide/how-to/creating-ebook-with-ai/
- FlipHTML5 AI Ebook Maker 보도자료 (2025-06, 책 크기·설정·공유): https://www.wfmj.com/story/52869823/fliphtml5-unveils-an-ai-ebook-maker-for-intelligent-content-creation
- FlipHTML5 AI Ebook Maker 보도자료 (아웃라인 승인 후 템플릿·테마색 선택): https://smb.state-journal.com/article/FlipHTML5s-AI-Ebook-Maker-Turns-Rough-Ideas-Into-Polished-Digital-Books/6a5d8a1beb7fd1000266d670
- FlipHTML5 AI Ebook Design Generator 보도자료 (브랜딩, AI 어시스턴트): https://pr.theoutlookonline.com/article/FlipHTML5and8217s-AI-Ebook-Design-Generator-Enables-Dynamic-Digital-Publication-Creation/69e1f8772d74530002721224
- Visual Paradigm AI Flipbook Maker: https://updates.visual-paradigm.com/?p=1303
- Designrr 기능 정리: https://topai.tools/t/designrr , https://us.fitgap.com/products/designrr , https://www.g2.com/products/designrr
- StPageFlip: https://github.com/Nodlik/StPageFlip , 문서 https://nodlik.github.io/StPageFlip/
