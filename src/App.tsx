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

  const triggerConfirm = (message: string, onConfirm: () => void) => {
    setConfirmModal({ message, onConfirm });
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl text-center space-y-8">
          <header className="space-y-4">
            <div className="inline-block p-4 mb-2">
              <MascotIcon character="moa" size="xl" className="mx-auto mascot-float" />
            </div>
            <h1 className="font-headline text-4xl md:text-5xl font-black text-primary-brand tracking-tight">
              모 두 모 아 (MOA)
            </h1>
            <div className="space-y-2">
              <p className="font-headline font-black text-xl md:text-2xl text-amber-500 italic max-w-md mx-auto">
                More Opinions, All together!
              </p>
              <p className="font-sans text-md md:text-lg text-slate-700 max-w-md mx-auto leading-relaxed">
                더 많은 의견을 모두 다 함께!<br />
                <span className="text-primary-brand/80 font-bold text-xs bg-white/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/40 shadow-sm inline-block mt-2">
                  초등학교 실시간 협력 토의 지원 웹앱
                </span>
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            {/* Start as Student */}
            <button
              onClick={() => setRole("student")}
              className="glass-panel flex flex-col items-center justify-center p-8 bg-white/40 border-2 border-white/50 rounded-3xl hover:scale-[1.03] transition-all text-center space-y-4 shadow-lg group"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shadow-inner group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-4xl">school</span>
              </div>
              <div>
                <h3 className="font-headline text-2xl font-black text-slate-800">학생 시작하기</h3>
                <p className="font-sans text-xs text-slate-500 mt-2 leading-relaxed">
                  선생님이 주신 6자리 코드를 입력하고,<br />
                  모둠 토의방에 참여합니다.
                </p>
              </div>
            </button>

            {/* Start as Teacher */}
            <button
              onClick={() => setRole("teacher")}
              className="glass-panel flex flex-col items-center justify-center p-8 bg-white/40 border-2 border-white/50 rounded-3xl hover:scale-[1.03] transition-all text-center space-y-4 shadow-lg group"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-inner group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-4xl">co_present</span>
              </div>
              <div>
                <h3 className="font-headline text-2xl font-black text-slate-800">교사 시작하기</h3>
                <p className="font-sans text-xs text-slate-500 mt-2 leading-relaxed">
                  새로운 토론 주제를 개설하고,<br />
                  학생 참여를 실시간 모니터링합니다.
                </p>
              </div>
            </button>
          </div>

          {/* 푸터 영역 */}
          <footer className="mt-16 text-center max-w-2xl mx-auto w-full text-slate-400 font-sans text-[11px] space-y-2 border-t border-slate-200/60 pt-6">
            <div className="flex justify-center gap-4 text-slate-500 font-bold mb-1">
              <a href="/api/이용약관.md" target="_blank" rel="noopener noreferrer" className="hover:text-amber-600 transition-colors">이용약관</a>
              <span className="text-slate-300">|</span>
              <a href="/api/개인정보처리방침.md" target="_blank" rel="noopener noreferrer" className="hover:text-amber-600 transition-colors">개인정보처리방침</a>
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
