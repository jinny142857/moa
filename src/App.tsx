import React, { useState, useEffect, useRef } from "react";
import { RoomState, Student } from "./types";
import TeacherLobby from "./components/TeacherLobby";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentJoin from "./components/StudentJoin";
import StudentBoard from "./components/StudentBoard";
import MascotIcon from "./components/MascotIcon";

export default function App() {
  const [role, setRole] = useState<"teacher" | "student" | null>(null);
  const [teacherUser, setTeacherUser] = useState<{ name: string; email: string; picture?: string } | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [error, setError] = useState("");

  const [confirmModal, setConfirmModal] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [documentModal, setDocumentModal] = useState<{ title: string; type: "terms" | "privacy" | null }>({ title: "", type: null });
  const [modalText, setModalText] = useState("");

  const TERMS_TEXT = `이용약관

본 이용약관(이하 '약관')은 서울원광초등학교 나혜진 교사(이하 '서비스 제공자')가 제공하는 교육용 실시간 협력 토의 웹 애플리케이션 서비스 모두모아 (MOA)(이하 '본 서비스')의 이용에 관한 사항을 규정합니다.

제1조 (목적)
이 약관은 서비스 제공자가 제공하는 무료 교육용 실시간 토의 웹 서비스(이하 '서비스')를 이용함에 있어 서비스 제공자와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (정의)
1. '서비스'란 본 플랫폼에서 제공하는 교육용 실시간 협력 토의 웹 애플리케이션(모두모아)을 말합니다.
2. '이용자'란 본 서비스에 접속하여 이 약관에 따라 서비스를 이용하는 교사 및 학생을 말합니다.
3. '교사 회원'란 구글 OAuth 인증을 통하여 인증을 완료하고 수업 프리셋 설계 및 토의방(세션)을 개설하여 통제하는 교사를 말합니다.
4. '학생 이용자'란 교사가 개설한 토의방의 6자리 코드를 입력하고 일시적으로 참여하여 의견을 내는 이용자를 말합니다.

제3조 (약관의 명시와 개정)
1. 본 서비스는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기 화면 또는 관련 안내 페이지에 게시합니다.
2. 본 서비스는 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있습니다.

제4조 (서비스의 제공)
1. 본 서비스는 초등학교 토의 및 협력 학습을 돕기 위한 공익 목적의 무료 웹 애플리케이션입니다.
2. 서비스의 이용은 무료이며, 별도의 광고나 유료 결제 모델이 존재하지 않습니다.

제5조 (서비스의 중단)
1. 본 서비스는 서버 점검, 교체 및 장애, 인터넷 통신 문제 등이 발생한 경우에는 서비스의 제공을 일시적으로 중단할 수 있습니다.
2. 본 서비스는 무료 교육 지원용 서비스이므로, 일시 중단이나 데이터 일시 소실로 인한 별도의 보상은 제공되지 않습니다.

제6조 (만 14세 미만 아동의 참여)
1. 초등학교 수업 특성상 만 14세 미만의 학생 이용자가 참여합니다. 해당 학급의 지도를 담당하는 교사는 보호자(법정대리인)의 개인정보 동의(학교 가정통신문 등) 여부를 수렴한 뒤 학생들을 본 서비스에 참여시켜야 합니다.
2. 학생 이용자는 회원가입을 거치지 않으며, 교사가 열어준 실시간 세션에 임시 이름으로 참여하고 세션이 종료(초기화)되면 기록이 안전하게 제거됩니다.

제7조 (이용자의 의무)
이용자는 다음 행위를 하여서는 안 됩니다.
1. 타인(동료 학생 또는 타 교사)의 정보를 도용하거나 비하하는 행위
2. 서비스의 실시간 연동 인프라 및 데이터베이스 서버에 악의적인 트래픽을 유발하여 운영을 방해하는 행위
3. 토의방 내부에서 비속어, 욕설, 따돌림 등 학습 분위기를 훼침과 동시에 공서양속에 반하는 텍스트나 데이터를 전송하는 행위

제8조 (저작권 및 데이터 소유권)
1. 본 서비스의 구조, 마스코트 캐릭터, 로직 등 플랫폼에 대한 저작권은 서비스 제공자에게 귀속합니다.
2. 학생들이 실시간 토의 중 제출한 의견 카드의 작성 책임은 해당 이용자에게 있으며, 교사는 교육 보고서 보관 목적으로 결과를 다운로드하여 보관할 수 있습니다.

제9조 (면책조항)
1. 본 서비스는 무료로 제공되는 교육용 서비스로서, 천재지변이나 불의의 서버 통신 두절 등 기술적 오류로 인한 중단에 대해 보상할 의무를 지지 않습니다.

제10조 (관할법원)
본 서비스와 이용자 간에 발생한 분쟁에 관하여는 대한민국 법을 적용하며, 서비스 제공자의 소재지(서울원광초등학교 관할 법원)를 관할법원으로 합니다.

부칙
이 약관은 2026년 7월 3일부터 시행됩니다.`;

  const PRIVACY_TEXT = `개인정보처리방침

모두모아 (MOA)(이하 '본 서비스')은(는) 개인정보 보호법 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 하기 위하여 다음과 같이 개인정보 처리방침을 수립·공개합니다.

제1조 (개인정보의 처리 목적)
본 서비스는 다음의 목적을 위하여 개인정보를 처리합니다.
1. 교사 회원 관리: 구글 OAuth 인증을 통한 교사 본인 식별, 수업 설계 프리셋 데이터 저장 및 조회 권한 관리
2. 실시간 토의 서비스 제공: 교사의 토의 세션 개설, 학생의 실시간 토의 참여(이름 입력 및 모둠 지정), 실시간 의견 카드(포스트잇) 제출 및 공감(좋아요) 처리, 투표 처리

제2조 (개인정보의 처리 및 보유기간)
1. 본 서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
2. 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다.
   - 교사 프리셋 데이터: 교사가 회원 탈퇴를 하거나 데이터를 직접 삭제하기 전까지 보관
   - 실시간 토의 세션 데이터: 토의 종료 후 교사가 방을 초기화(리셋)할 때 즉시 파기하거나, 해당 학년도 종료 시(익년 2월 말) 또는 최종 학습 활동 완료 시까지
   - 파기 시점: 보유 기간 종료 후 지체 없이(5일 이내) 파기

제3조 (처리하는 개인정보 항목)
본 서비스는 학습 지원을 위해 필요한 최소한의 개인정보만을 수집합니다.
1. 교사 (Google 인증 회원): 구글 계정 이메일, 이름, 프로필 사진 URL (인증용)
2. 학생 (세션 참여자): 참여를 위해 본인이 직접 입력한 이름(또는 닉네임)
3. 수집하지 않는 항목: 주민등록번호, 주소, 학생의 전화번호 및 이메일 등 불필요한 민감 정보

제4조 (만 14세 미만 아동의 개인정보 처리에 관한 사항)
1. 본 서비스는 만 14세 미만 초등학생 아동의 수업 참여를 목적으로 운영됩니다. 학생이 세션 참여 시 본인의 이름(또는 닉네임)을 일시 입력하므로, 교사는 학기 초 학교 가정통신문(개인정보 수집·이용 동의서)을 통하여 법정대리인의 동의를 확인한 후 수업을 진행하여야 합니다.
2. 법정대리인이 동의하지 않는 경우, 해당 아동은 실시간 토의 서비스 참여가 제한될 수 있습니다.

제5조 (개인정보의 파기 절차 및 방법)
1. 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.
2. 파기 방법: 데이터베이스(Supabase)에 전자적 파일 형태로 기록·저장된 개인정보는 기록을 재생할 수 없도록 물리적·기술적으로 영구 삭제합니다.

제6조 (개인정보의 안전성 확보조치)
본 서비스는 개인정보 보호법 제29조에 따라 다음과 같이 안전성 확보에 필요한 기술적/관리적 및 물리적 조치를 하고 있습니다.
1. 해킹 등에 대비한 기술적 대책: 보안 인증을 획득한 전문 데이터베이스 플랫폼(Supabase) 및 클라우드 호스팅 서비스를 기반으로 운영되며, 전 구간 보안 통신(HTTPS)을 사용하여 데이터를 암호화하여 전송합니다.
2. 개인정보 취급 직원의 최소화: 본 서비스의 관리 및 개발 책임 교사 1인에게만 데이터베이스 관리 권한을 부여하고 접근을 통제합니다.

제7조 (정보주체와 법정대리인의 권리·의무 및 행사방법)
1. 정보주체(학생 및 교사) 및 법정대리인은 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.
2. 권리 행사는 교사의 경우 프리셋 관리 화면 내 삭제 기능, 학생의 경우 교사에게 의견 카드의 삭제 요청이나 교사의 방 초기화를 통해 언제든지 조치할 수 있으며, 개발 책임 교사에게 연락 시 지체 없이 처리하겠습니다.

제8조 (개인정보 보호책임자)
본 서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
- 성명: 나혜진 (개발 책임 교사)
- 소속: 서울원광초등학교
- 직위: 교사
- 연락처: 서울원광초등학교 교무실 (※ 개인정보보호를 위해 교사의 개인 휴대전화 번호는 기재하지 않습니다.)

제9조 (개인정보 처리방침 변경)
이 개인정보 처리방침은 2026년 7월 3일부터 적용됩니다.`;

  const openDocumentModal = (type: "terms" | "privacy", title: string) => {
    const text = type === "terms" ? TERMS_TEXT : PRIVACY_TEXT;
    setModalText(text);
    setDocumentModal({ title, type });
  };

  const triggerConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
  };

  const renderDocumentModal = () => {
    if (!documentModal.type) return null;
    return (
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in select-none">
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200/60 flex flex-col max-h-[80vh] animate-scale-in">
          <header className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-3xl">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">description</span>
              {documentModal.title}
            </h3>
            <button
              onClick={() => setDocumentModal({ title: "", type: null })}
              className="p-1.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined text-md">close</span>
            </button>
          </header>
          <div className="p-6 overflow-y-auto font-sans text-xs text-slate-600 leading-relaxed whitespace-pre-wrap select-text text-left">
            {modalText}
          </div>
          <footer className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-3xl">
            <button
              onClick={() => setDocumentModal({ title: "", type: null })}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-full shadow-sm active:translate-y-0.5 transition-all"
            >
              닫기
            </button>
          </footer>
        </div>
      </div>
    );
  };

  const renderConfirmModal = () => {
    if (!confirmModal) return null;
    return (
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-2xl border border-slate-200/60 space-y-4 animate-scale-in">
          <div className="flex items-center gap-3 text-primary-brand">
            <span className="material-symbols-outlined text-3xl">help</span>
            <h3 className="font-headline text-lg font-bold text-slate-800">확인해 주세요</h3>
          </div>
          <p className="font-sans text-sm text-slate-600 leading-relaxed">
            {confirmModal.message}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmModal(null)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-headline font-bold text-sm rounded-xl transition-all"
            >
              취소
            </button>
            <button
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal(null);
              }}
              className="px-4 py-2 bg-primary-brand hover:bg-amber-600 text-white font-headline font-bold text-sm rounded-xl transition-all shadow-md"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  };

  const eventSourceRef = useRef<EventSource | null>(null);

  // Sync state from server using Server-Sent Events (SSE)
  const connectSSE = (roomId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/rooms/${roomId.toUpperCase()}/events`);
    
    es.onmessage = (event) => {
      try {
        const updatedRoom: RoomState = JSON.parse(event.data);
        setRoom(updatedRoom);
        
        // If we are logged in as a student, sync our own student state
        if (role === "student" && student) {
          const syncedStudent = updatedRoom.students.find((s) => s.name === student.name);
          if (syncedStudent) {
            setStudent(syncedStudent);
          }
        }
      } catch (err) {
        console.error("Failed to parse SSE payload:", err);
      }
    };

    es.onerror = () => {
      console.warn("SSE disconnected, attempting retry...");
    };

    eventSourceRef.current = es;
  };

  // Close SSE connection on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Listen for Google Auth callback messages from popups
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
        const user = event.data.user;
        setTeacherUser(user);
        localStorage.setItem("moa_teacher", JSON.stringify(user));
      }
    };
    window.addEventListener("message", handleAuthMessage);

    // Retrieve saved teacher login from localStorage
    const savedTeacher = localStorage.getItem("moa_teacher");
    if (savedTeacher) {
      try {
        setTeacherUser(JSON.parse(savedTeacher));
      } catch (e) {}
    }

    return () => window.removeEventListener("message", handleAuthMessage);
  }, []);

  // Retrieve session from localStorage on load
  useEffect(() => {
    const savedRole = localStorage.getItem("moa_role");
    const savedRoomId = localStorage.getItem("moa_room_id");
    const savedStudentName = localStorage.getItem("moa_student_name");

    if (savedRole && savedRoomId) {
      setRole(savedRole as "teacher" | "student");
      
      // Fetch current status
      fetch(`/api/rooms/${savedRoomId}`)
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Stale session");
        })
        .then((data: RoomState) => {
          setRoom(data);
          connectSSE(savedRoomId);
          
          if (savedRole === "student" && savedStudentName) {
            const currentStudent = data.students.find((s) => s.name === savedStudentName);
            if (currentStudent) {
              setStudent(currentStudent);
            }
          }
        })
        .catch(() => {
          // Clear broken cache
          localStorage.removeItem("moa_role");
          localStorage.removeItem("moa_room_id");
          localStorage.removeItem("moa_student_name");
        });
    }
  }, []);

  // Teacher actions
  const handleCreateRoom = async (
    topic: string, 
    character: string, 
    studentNames: string[],
    stepPrompts?: string[],
    hasArtifact?: boolean,
    groupCount?: number,
    questions?: string[],
    hasVote?: boolean,
    questionsUseRandom?: boolean[]
  ) => {
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, character, studentNames, stepPrompts, hasArtifact, groupCount, questions, hasVote, questionsUseRandom }),
      });
      const data = await res.json();
      setRoom(data.room);
      localStorage.setItem("moa_role", "teacher");
      localStorage.setItem("moa_room_id", data.roomId);
      localStorage.setItem("moa_active_room_id", data.roomId); // 진행 중인 활성 방으로 기억
      connectSSE(data.roomId);
    } catch (err) {
      setError("방 생성 도중 오류가 발생했습니다.");
    }
  };

  const handleUpdateRoom = async (config: {
    topic: string;
    character: string;
    studentNames: string[];
    stepPrompts: string[];
    hasArtifact: boolean;
    groupCount: number;
    questions?: string[];
    hasVote?: boolean;
  }) => {
    if (!room) return;
    try {
      const res = await fetch(`/api/rooms/${room.roomId}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.room) {
        setRoom(data.room);
      }
    } catch (err) {
      console.error("Failed to update active room settings", err);
    }
  };

  const handleStartLesson = async () => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIndex: 1 }), // Advance to thought formulation
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepChange = async (stepIndex: number) => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIndex }),
      });

      // Auto start a voting session when entering Step (M * 2 + 1)
      const questionsCount = room.questions?.length || 1;
      const votingStepIndex = questionsCount * 2 + 1;
      if (room.hasVote && stepIndex === votingStepIndex) {
        await fetch(`/api/rooms/${room.roomId}/vote/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: "all",
            question: "우리 모둠에서 실천성이 가장 높은 가장 좋은 의견 카드는 무엇인가요?",
            options: ["아주 훌륭하다 (실천 100%)", "노력이 필요하다 (실천 50%)", "더 구체적인 의논이 필요하다"],
          }),
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuietModeToggle = async (active: boolean) => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/quiet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isQuietMode: active }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerAlert = async (groupId: string | number, alertType: "encourage" | "warning", alertMessage: string) => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, alertType, alertMessage }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTimerToggle = async (active: boolean) => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/timer/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleTimerReset = async (duration?: number) => {
    if (!room) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/timer/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetRoom = () => {
    triggerConfirm("정말 현재 토의 세션을 완전히 종료하고 새 토의 주제 빌더로 돌아가시겠습니까?", () => {
      localStorage.clear();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setRole("teacher");
      setRoom(null);
      setStudent(null);
    });
  };

  // Student actions
  const handleStudentJoin = async (
    roomId: string,
    name: string,
    avatarColor: string,
    avatarIcon: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/rooms/${roomId.toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarColor, avatarIcon }),
      });
      if (!res.ok) return false;
      
      const data = await res.json();
      setStudent(data.student);
      setRoom(data.room);
      setRole("student");
      
      localStorage.setItem("moa_role", "student");
      localStorage.setItem("moa_room_id", roomId.toUpperCase());
      localStorage.setItem("moa_student_name", name);
      
      connectSSE(roomId);
      return true;
    } catch (err) {
      return false;
    }
  };

  const handlePostItSubmit = async (text: string, color: string) => {
    if (!room || !student) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/postit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: student.groupId,
          studentName: student.name,
          text,
          color,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLikePostIt = async (postitId: string) => {
    if (!room || !student) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/postit/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: student.groupId,
          postitId,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePostIt = async (postitId: string) => {
    if (!room || !student) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/postit/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: student.groupId,
          postitId,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDrawSpeaker = async () => {
    if (!room || !student) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/draw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: student.groupId,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePassSpeaker = async () => {
    if (!room || !student) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/pass`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: student.groupId,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAlert = async () => {
    if (!room || !student) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/alert/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: student.groupId,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleVoteSubmit = async (optionId: string) => {
    if (!room || !student) return;
    try {
      await fetch(`/api/rooms/${room.roomId}/vote/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: student.groupId,
          studentName: student.name,
          optionId,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveSession = async () => {
    triggerConfirm("정말 토의실을 나가시겠습니까?", async () => {
      if (room && student) {
        try {
          await fetch(`/api/rooms/${room.roomId}/leave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: student.name }),
          });
        } catch (e) {
          // ignore
        }
      }
      localStorage.clear();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setRole(null);
      setRoom(null);
      setStudent(null);
    });
  };

  // Render role selection screen (landing page)
  if (!role) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 flex flex-col justify-between p-4 md:p-6 select-none">
        <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full space-y-4 md:space-y-6">
          <header className="text-center space-y-2">
            <div className="inline-block p-2">
              <MascotIcon character="moa" size="lg" className="mx-auto mascot-float" />
            </div>
            <h1 className="font-headline text-3xl md:text-4xl font-black text-primary-brand tracking-tight">
              모 두 모 아 (MOA)
            </h1>
            <div className="space-y-1">
              <p className="font-headline font-black text-lg md:text-xl text-amber-500 italic max-w-md mx-auto">
                More Opinions, All together!
              </p>
              <p className="font-sans text-xs md:text-sm text-slate-700 max-w-md mx-auto leading-relaxed">
                더 많은 의견을 모두 다 함께!<br />
                <span className="text-primary-brand/80 font-bold text-[10px] bg-white/60 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/40 shadow-sm inline-block mt-1">
                  초등학교 실시간 협력 토의 지원 웹앱
                </span>
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2">
            {/* Start as Student */}
            <button
              onClick={() => setRole("student")}
              className="glass-panel flex flex-col items-center justify-center p-5 bg-white/40 border border-white/50 rounded-2xl hover:scale-[1.02] transition-all text-center space-y-2 shadow-md group"
            >
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-3xl">school</span>
              </div>
              <div>
                <h3 className="font-headline text-lg font-black text-slate-800">학생 시작하기</h3>
                <p className="font-sans text-[11px] text-slate-500 mt-1 leading-normal">
                  선생님이 주신 6자리 코드를 입력하고,<br />
                  모둠 토의방에 참여합니다.
                </p>
              </div>
            </button>

            {/* Start as Teacher */}
            <button
              onClick={() => setRole("teacher")}
              className="glass-panel flex flex-col items-center justify-center p-5 bg-white/40 border border-white/50 rounded-2xl hover:scale-[1.02] transition-all text-center space-y-2 shadow-md group"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-inner group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-3xl">co_present</span>
              </div>
              <div>
                <h3 className="font-headline text-lg font-black text-slate-800">교사 시작하기</h3>
                <p className="font-sans text-[11px] text-slate-500 mt-1 leading-normal">
                  새로운 토론 주제를 개설하고,<br />
                  학생 참여를 실시간 모니터링합니다.
                </p>
              </div>
            </button>
          </div>

          {/* 푸터 영역 */}
          <footer className="w-full text-center text-slate-400 font-sans text-[10px] space-y-1.5 border-t border-slate-200/60 pt-4 mt-2">
            <div className="flex justify-center gap-4 text-slate-500 font-bold">
              <button
                onClick={() => openDocumentModal("terms", "이용약관")}
                className="hover:text-amber-600 transition-colors"
              >
                이용약관
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => openDocumentModal("privacy", "개인정보처리방침")}
                className="hover:text-amber-600 transition-colors"
              >
                개인정보처리방침
              </button>
            </div>
            <p className="leading-relaxed text-slate-400/80">
              책임자: 서울원광초등학교 교사 나혜진
            </p>
            <p className="text-slate-400/60">
              © 2026 모두모아 (MOA). All Rights Reserved. 본 웹앱은 초등학교 교실 실시간 협력 토의용 교육용 무료 플랫폼입니다.
            </p>
          </footer>
        </div>
      </div>
    );
  }

  // Helper to trigger Google Login Popup
  const handleGoogleLogin = async () => {
    try {
      const res = await fetch("/api/auth/google/url");
      const data = await res.json();
      
      const width = 500;
      const height = 650;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      if (data.useMock) {
        window.open(
          "/auth/mock-google",
          "google_oauth_popup",
          `width=${width},height=${height},top=${top},left=${left}`
        );
      } else {
        window.open(
          data.url,
          "google_oauth_popup",
          `width=${width},height=${height},top=${top},left=${left}`
        );
      }
    } catch (err) {
      console.error("Failed to generate Google Sign-In url:", err);
    }
  };

  // Render teacher mode with Google Auth check
  if (role === "teacher") {
    if (!teacherUser) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-amber-50/20">
          <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-200/80 text-center space-y-6">
            <header className="space-y-2">
              <button
                onClick={() => setRole(null)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                돌아가기
              </button>
              <div className="flex justify-center pt-2">
                <MascotIcon character="moa" size="lg" className="mascot-float" />
              </div>
              <h1 className="font-headline text-2xl font-black text-slate-800">선생님 전용 로그인</h1>
              <p className="font-sans text-xs text-slate-500">
                토의 생성, 단계별 발문 편집, 산출물 유무 지정, 모둠 수 설정 등의 관리자 권한을 위해 구글 계정으로 로그인해 주세요.
              </p>
            </header>

            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 border-2 border-slate-200 py-3 px-4 rounded-2xl shadow-sm transition-all duration-200 active:scale-95 text-slate-700 font-headline font-bold text-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              Google 계정으로 로그인
            </button>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              모두 모아는 개인정보를 안전하게 처리하며, 구글 인증을 통해서만 관리자 교사 모드에 접근할 수 있습니다.
            </p>
          </div>
        </div>
      );
    }

    if (!room || room.currentStepIndex === 0) {
      return (
        <>
          <TeacherLobby
            room={room}
            onCreateRoom={handleCreateRoom}
            onStartLesson={handleStartLesson}
            teacherUser={teacherUser}
            onBack={() => {
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
              }
              localStorage.removeItem("moa_role");
              localStorage.removeItem("moa_room_id");
              setRole(null);
              setRoom(null);
            }}
          />
          {renderConfirmModal()}
        </>
      );
    }
    return (
      <>
        <TeacherDashboard
          room={room}
          onStepChange={handleStepChange}
          onQuietModeToggle={handleQuietModeToggle}
          onTriggerAlert={handleTriggerAlert}
          onTimerToggle={handleTimerToggle}
          onTimerReset={handleTimerReset}
          onResetRoom={handleResetRoom}
          teacherUser={teacherUser}
          onUpdateRoom={handleUpdateRoom}
          onBack={() => {
            triggerConfirm("정말 교사 대시보드를 닫고 처음 화면으로 돌아가시겠습니까? (현재 세션 상태는 그대로 유지됩니다)", () => {
              if (eventSourceRef.current) {
                eventSourceRef.current.close();
              }
              localStorage.removeItem("moa_role");
              localStorage.removeItem("moa_room_id");
              setRole(null);
              setRoom(null);
            });
          }}
        />
        {renderConfirmModal()}
      </>
    );
  }

  // Render student mode
  if (role === "student") {
    if (!room || !student) {
      return (
        <>
          <StudentJoin
            onJoin={handleStudentJoin}
            error={error}
            onBack={() => {
              localStorage.removeItem("moa_role");
              localStorage.removeItem("moa_room_id");
              setRole(null);
            }}
          />
          {renderConfirmModal()}
        </>
      );
    }
    return (
      <>
        <StudentBoard
          room={room}
          student={student}
          onPostIt={handlePostItSubmit}
          onLikePostIt={handleLikePostIt}
          onDeletePostIt={handleDeletePostIt}
          onDrawSpeaker={handleDrawSpeaker}
          onPassSpeaker={handlePassSpeaker}
          onClearAlert={handleClearAlert}
          onVote={handleVoteSubmit}
          onLeave={handleLeaveSession}
        />
        {renderConfirmModal()}
      </>
    );
  }

  return null;
}
