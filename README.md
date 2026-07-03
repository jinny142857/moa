# 💬 모두모아 (MOA) - 초등 실시간 협력 토의 지원 플랫폼

> **"더 많은 의견을, 모두 다 함께!"**
> 모두모아(MOA)는 초등학교 교실에서 학생들이 기기를 활용하여 소외되는 친구 없이 모두가 참여하고 의견을 나누며 깊이 있는 배움을 이뤄가는 실시간 협력 토의 지원 웹 애플리케이션입니다.

## 📸 서비스 주요 화면 (Screenshots)

| 메인 로비 (진입 화면) | 학생 모둠 칠판 (실시간 토의) | 교사 실시간 관제 대시보드 |
|:---:|:---:|:---:|
| ![메인 로비](https://raw.githubusercontent.com/jinny142857/moa/main/screenshots/main_lobby.png) | ![학생 모둠 칠판](https://raw.githubusercontent.com/jinny142857/moa/main/screenshots/student_board.png) | ![교사 대시보드](https://raw.githubusercontent.com/jinny142857/moa/main/screenshots/teacher_dashboard.png) |

---

## 💡 기획 의도 및 해결하고자 하는 문제
초등학교 모둠 토의 수업 시, 발표를 독점하는 학생과 위축되어 의견을 내지 못하는 학생 간의 참여 불균형이 자주 발생합니다. 또한, 자판 입력이 느린 저학년 학생들은 텍스트로 생각을 정리하는 데 많은 시간이 걸립니다.
**모두모아 (MOA)**는 이러한 교실의 실제적인 애로사항을 해결하기 위해 개발되었습니다.
*   **음성 인식(STT)과 생성형 AI(Gemini)**를 결합하여 말로 쉽게 생각을 적을 수 있도록 돕습니다.
*   **실시간 슬롯머신형 발표 추첨기**를 제공하여 누구나 공평하게 발표 순서를 갖고 참여할 수 있도록 돕습니다.
*   **기기 간 실시간 동기화(SSE)** 및 **교사 관제 대시보드**를 통해 교사가 모둠별 진행 상황을 완벽하게 진단하고 실시간 퍼실리테이팅할 수 있게 지원합니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 🧑‍🏫 교사용 수업 설계 및 모니터링 대시보드
*   **토의 설계 프리셋**: 토의 대주제, 세부 질문(발문), 모둠 수, 투표 여부 등을 직관적으로 설계하고 Supabase 데이터베이스에 영구 보관할 수 있습니다.
*   **구글 OAuth 연동**: 교사 계정 보호를 위해 안전한 구글 인증 로그인을 탑재했습니다.
*   **실시간 모니터링**: 각 모둠별 학생들의 참여 여부, 활동 빈도(활성/비활성), 제출된 의견의 내용(스크롤 뷰를 통한 실시간 텍스트 확인), 좋아요 및 투표 개수를 실시간 관제합니다.
*   **강력한 원격 통제 기능**:
    *   **마이크 및 입력 잠금 (Quiet Mode)**: 집중해야 할 시간에 학생 화면을 잠그고 교사 화면을 보게 합니다.
    *   **격려/경고 알림 전송**: 특정 모둠에 개별 맞춤 메시지를 즉시 전송하여 활성화를 유도합니다.
    *   **글로벌 타이머 조작**: 모든 학생 화면의 남은 토의 시간을 동시에 재생/일시정지/리셋합니다.
*   **결과 보고서 다운로드**: 모둠별 요약 및 학생들이 제출한 모든 의견 카드 데이터를 Excel 호환 CSV 파일로 원클릭 백업합니다.

### 2. 🎒 학생용 실시간 협력 토의 보드
*   **1단계: 토의 진행 (생각 작성 & 발표 순서 정하기)**
    *   **말로 입력하기**: Web Speech API 기반 STT를 구현하여, 마이크 단추를 누르고 말하면 실시간 받아쓰기가 진행됩니다.
    *   **Gemini AI 말하기 교정**: 받아쓰기 완료 시 **Gemini API**가 문맥을 분석하여 초등학생 수준에 알맞은 매끄러운 한글 문장으로 완성도 있게 다듬어 줍니다.
    *   **발표 순서 정하기 (슬롯머신)**: 🎰 기기 간 동기화되는 슬롯머신 추첨기로 순서를 공평하게 정합니다. 남은 인원이 1명일 때는 자동으로 마무리가 지정되는 특수 규칙이 내장되어 있습니다. (교사 빌더에서 질문별 ON/OFF 가능)
    *   **실시간 모둠 칠판**: 친구들이 의견을 제출할 때마다 같은 모둠원들의 화면 칠판에 실시간으로 의견 텍스트가 렌더링되어 서로의 생각을 즉시 확인합니다.
*   **2단계: 생각 모으기 (공감 하트 부여)**
    *   칠판에 모인 친구들의 카드 내용을 찬찬히 읽으며, 공감되거나 좋은 아이디어에 하트(❤️ 좋아요) 피드백을 전달합니다.
*   **미니 투표**: 수업 막바지에 실천성이 가장 높은 아이디어를 선정하기 위해 모둠원 전원이 실시간 투표에 참여합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

### Frontend
*   **React (TypeScript)**
*   **CSS / TailwindCSS** (Aesthetic UI/UX 테마 적용)
*   **Web Speech API** (실시간 음성인식)

### Backend & Database
*   **Node.js (Express)**
*   **Server-Sent Events (SSE)** (웹소켓 대비 가볍고 끊김 없는 단방향 실시간 동기화)
*   **Supabase (PostgreSQL)** (수업 프리셋 정보 보관 및 포스트잇 저장)

### AI
*   **Google Gemini API (via @google/genai)** (초등학생용 구어체 정제 및 문맥 교정 비서 역할)

---

## 📂 프로젝트 구조 (Project Directory)
```
moa/
├── server.ts               # Express 백엔드 (SSE 이벤트 허브, Gemini 연동, Google OAuth API)
├── vercel.json             # Vercel 배포 설정 파일
├── index.html              # 엔트리 포인트 HTML
├── 개인정보처리방침.md     # 개인정보 처리 지침 문서
├── 이용약관.md             # 서비스 이용 규칙 약관
├── src/
│   ├── App.tsx             # 프론트엔드 라우팅 및 상태 제어 코어
│   ├── main.tsx            # React 돔 렌더러
│   ├── types.ts            # RoomState, Group, Student 등 인터페이스 정의 파일
│   └── components/
│       ├── TeacherLobby.tsx     # 교사용 대기실 및 프리셋 빌더
│       ├── TeacherDashboard.tsx # 교사용 실시간 관제 모니터링 대시보드
│       ├── StudentJoin.tsx      # 학생 로그인/방 입장 컴포넌트
│       ├── StudentBoard.tsx     # 학생용 실시간 보드 (추첨기, 의견 제출, 모둠 칠판)
│       └── MascotIcon.tsx       # 사회자 캐릭터 마스코트 아이콘 컴포넌트
```

---

## 🚀 로컬 실행 방법 (How to Run Locally)

### 1. 환경 변수 설정
프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래 키를 입력합니다.
*(Vercel 배포 환경에서는 대소문자 및 오타에 유연하게 대응하는 자동 세척 로직이 내장되어 있습니다.)*
```env
PORT=3000
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

### 2. 패키지 설치 및 실행
```bash
# 의존성 패키지 설치
npm install

# 로컬 개발 서버 구동 (프론트엔드 Vite + 백엔드 Express 동시 가동)
npm run dev
```
가동 후 브라우저에서 `http://localhost:3000`으로 접속하면 로컬에서 즉시 구동 및 기기 간 동기화 테스트가 가능합니다.
