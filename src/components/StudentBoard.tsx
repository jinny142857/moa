import React, { useState, useEffect, useRef } from "react";
import { RoomState, Student, Group, PostIt } from "../types";
import MascotIcon from "./MascotIcon";

interface StudentBoardProps {
  room: RoomState;
  student: Student;
  onPostIt: (text: string, color: string) => void;
  onLikePostIt: (postitId: string) => void;
  onDeletePostIt: (postitId: string) => void;
  onDrawSpeaker: () => void;
  onPassSpeaker: () => void;
  onClearAlert: () => void;
  onVote: (optionId: string) => void;
  onLeave: () => void;
}

export default function StudentBoard({
  room,
  student,
  onPostIt,
  onLikePostIt,
  onDeletePostIt,
  onDrawSpeaker,
  onPassSpeaker,
  onClearAlert,
  onVote,
  onLeave,
}: StudentBoardProps) {
  const [postItText, setPostItText] = useState("");
  const [postItColor, setPostItColor] = useState("#ffd93d"); // default yellow sticky
  
  // STT Microphone Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);
  const recognitionRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef("");
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(60);

  // 60초 음성인식 카운트다운 타이머
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      setRecordingTimeLeft(60);
      interval = setInterval(() => {
        setRecordingTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            // 60초 만료 시 녹음 중지 (onend가 자동 제출을 실행함)
            if (recognitionRef.current) {
              recognitionRef.current.stop();
            }
            setIsRecording(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setRecordingTimeLeft(60);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Slot-Machine Reel Animation States for presenter draw
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayedSpinnerName, setDisplayedSpinnerName] = useState("");

  // Collaborative Artifact States
  const [artifactInput, setArtifactInput] = useState("");
  const [isSavingArtifact, setIsSavingArtifact] = useState(false);

  const group = room.groups.find((g) => g.id === student.groupId) || room.groups[0];

  // Dynamic timeline calculations
  const questionsCount = room.questions?.length || 1;
  const maxStepIndex = questionsCount * 2 + (room.hasVote ? 1 : 0) + 1;
  const isQuestionStep = room.currentStepIndex >= 1 && room.currentStepIndex <= questionsCount * 2;
  const currentQuestionIndex = isQuestionStep ? Math.floor((room.currentStepIndex - 1) / 2) : 0;
  const stageIndex = isQuestionStep ? (room.currentStepIndex - 1) % 2 : null;
  const votingStepIndex = room.hasVote ? questionsCount * 2 + 1 : -1;

  useEffect(() => {
    if (group?.artifactText !== undefined) {
      setArtifactInput(group.artifactText);
    }
  }, [group?.artifactText]);

  const handleSaveArtifact = async () => {
    if (!group) return;
    setIsSavingArtifact(true);
    try {
      await fetch(`/api/rooms/${room.roomId}/group/${group.id}/artifact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactText: artifactInput }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingArtifact(false);
    }
  };

  const stickyColors = [
    { name: "노랑", hex: "#FEF08A" }, // Beautiful soft yellow
    { name: "파랑", hex: "#DBEAFE" }, // Soft blue
    { name: "초록", hex: "#D1FAE5" }, // Soft emerald
    { name: "핑크", hex: "#FFE4E6" }, // Soft rose
  ];

  // Sync displayed speaker spin animation when backend triggers current speaker changes
  useEffect(() => {
    if (group?.currentSpeaker && !group.drawnSpeakers.includes(group.currentSpeaker)) {
      // Draw was triggered but spinner hasn't run locally, simulate draw spin
      setIsSpinning(true);
      let count = 0;
      const teammates = room.students.filter((s) => s.groupId === group.id && s.active);
      const names = teammates.map((t) => t.name);
      
      const interval = setInterval(() => {
        if (names.length > 0) {
          setDisplayedSpinnerName(names[Math.floor(Math.random() * names.length)]);
        }
        count++;
        if (count > 15) {
          clearInterval(interval);
          setDisplayedSpinnerName(group.currentSpeaker || "");
          setIsSpinning(false);
        }
      }, 100);
      
      return () => clearInterval(interval);
    } else {
      setDisplayedSpinnerName(group?.currentSpeaker || "");
    }
  }, [group?.currentSpeaker]);

  // Web Speech API (STT) implementation
  const handleStartSTT = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("이 브라우저에서는 음성 인식을 지원하지 않습니다. 구글 크롬 브라우저를 사용해 주세요!");
      return;
    }

    if (isRecording) {
      // Stop recording (this will trigger onend automatically)
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    accumulatedTranscriptRef.current = "";
    const rec = new SpeechRecognition();
    rec.lang = "ko-KR";
    // continuous를 true로 설정하여 어린이의 말하기 도중 긴 멈춤(pause)이 있어도 마이크가 꺼지지 않도록 보장합니다.
    rec.continuous = true;
    // interimResults를 true로 설정하여 실시간으로 실시간 텍스트 변환을 수집하고 업데이트가 누락되지 않도록 합니다.
    rec.interimResults = true;

    rec.onstart = () => {
      setIsRecording(true);
    };

    rec.onerror = (e: any) => {
      console.error("Speech Recognition error:", e);
      setIsRecording(false);
    };

    rec.onend = async () => {
      setIsRecording(false);
      const textToSubmit = accumulatedTranscriptRef.current.trim();
      console.log("STT recording ended. Text to submit:", textToSubmit);
      if (!textToSubmit) {
        setPostItText("");
        return;
      }

      setSttLoading(true);
      try {
        // Gemini AI 교정 API 호출
        const res = await fetch(`/api/rooms/${room.roomId}/stt-correct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToSubmit }),
        });
        const data = await res.json();
        const correctedText = data.correctedText || textToSubmit;
        
        // 텍스트 변환 후 자동으로 보드(칠판)에 즉시 게시
        onPostIt(correctedText, postItColor);
      } catch (err) {
        console.error("Failed to correct and submit STT speech card:", err);
        // 에러 시 원본 텍스트로 보드에 즉시 자동 게시
        onPostIt(textToSubmit, postItColor);
      } finally {
        accumulatedTranscriptRef.current = "";
        setPostItText("");
        setSttLoading(false);
      }
    };

    rec.onresult = (event: any) => {
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        // 실시간(중간) 인식 텍스트도 취합하여 누락을 완전히 방지
        fullTranscript += event.results[i][0].transcript + " ";
      }
      accumulatedTranscriptRef.current = fullTranscript.trim();
      setPostItText(accumulatedTranscriptRef.current); // 실시간 텍스트 영역 동기화하여 화면 노출 보장
      console.log("STT progress:", accumulatedTranscriptRef.current);
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const handlePostItSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!postItText.trim()) return;

    // 만약 음성인식 녹음이 활성화되어 있었다면, 중복 제출을 막기 위해 음성인식을 먼저 깔끔하게 꺼줍니다.
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // onend가 중복 제출하는 걸 방지
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    }

    onPostIt(postItText, postItColor);
    setPostItText("");
    accumulatedTranscriptRef.current = "";
  };

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm border border-slate-200">
          <p className="font-headline font-bold text-slate-800">모둠을 찾을 수 없습니다.</p>
          <p className="text-xs text-slate-500 mt-2">선생님이 설정하신 모둠 수가 변경되었을 수 있습니다.</p>
          <button onClick={onLeave} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-full text-sm font-bold">뒤로가기</button>
        </div>
      </div>
    );
  }

  // Active vote verification
  const userHasVoted = group.activeVote?.votedStudents.includes(student.name) || false;

  // Filter classmates of the active group
  const groupStudents = room.students.filter((s) => s.groupId === group.id);
  const activeGroupStudents = groupStudents.filter((s) => s.active);

  // Reusable Facilitator Speech Bubble helper (compacted to prevent vertical scrolling)
  const renderSpeechBubble = (text: string) => {
    return (
      <div className="flex gap-3 items-center bg-white px-4 py-2.5 rounded-2xl shadow-sm border border-slate-100 shrink-0">
        <div className="shrink-0 w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center overflow-hidden">
          <MascotIcon character={room.character} size="sm" className="scale-110" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-slate-700 text-xs md:text-sm leading-normal font-medium">
            {text}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-[1024px] h-[768px] max-w-full mx-auto bg-[#FDFCF8] text-[#2D2D2D] font-sans flex flex-col overflow-hidden select-none shadow-2xl relative border border-slate-200 rounded-3xl">
      {/* 1. QUIET MODE LOCK OVERLAY PANEL (쉿! 모드) */}
      {room.isQuietMode && (
        <div className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in backdrop-blur-sm rounded-3xl">
          <div className="bg-white max-w-md w-full p-8 rounded-3xl border-4 border-amber-400 shadow-2xl flex flex-col items-center">
            <span className="material-symbols-outlined text-amber-500 text-8xl animate-pulse mb-4">
              volume_off
            </span>
            <MascotIcon character={room.character} size="lg" className="mb-4" />
            <h2 className="font-headline text-3xl font-black text-amber-600 mb-2">
              쉿! 조용히! ⏸️
            </h2>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="font-sans text-lg font-bold text-slate-700">
                "잠시 스마트 기기 사용을 멈추고, 앞쪽 선생님을 집중해 주세요!"
              </p>
            </div>
            <p className="font-sans text-xs text-slate-400 mt-4">
              선생님이 쉿! 모드를 풀면 화면이 자동으로 열려요.
            </p>
          </div>
        </div>
      )}

      {/* 2. GROUP CUSTOM ALERTS BOX */}
      {group.alertMessage && (
        <div className="absolute top-4 inset-x-4 z-40 bg-white border-2 border-primary-brand p-4 rounded-2xl shadow-xl flex items-start gap-4 animate-bounce max-w-lg mx-auto">
          <MascotIcon character={room.character} size="sm" />
          <div className="flex-1">
            <p className="font-headline text-md font-black text-primary-brand">
              {group.alertType === "encourage" ? "🎉 격려 카드가 도착했어요!" : "📢 알림이 왔어요!"}
            </p>
            <p className="font-sans text-sm text-slate-700 mt-1">{group.alertMessage}</p>
            <button
              onClick={onClearAlert}
              className="mt-2 bg-orange-500 hover:bg-orange-600 text-white font-headline text-xs font-black px-4 py-1.5 rounded-full shadow-sm transition-all"
            >
              알겠어요! 👍
            </button>
          </div>
        </div>
      )}

      {/* Header Navigation */}
      <header className="h-20 bg-white border-b-2 border-[#E5E5E5] flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-400 rounded-2xl flex items-center justify-center shadow-sm">
            <span className="text-white font-black text-2xl">M</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <span>모두모아</span>
              <span className="text-orange-500 text-sm font-black tracking-widest bg-orange-50 px-2 py-0.5 rounded">MOA</span>
            </h1>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
              Group {group.id} • Room #{room.roomId}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">남은 토의 시간</span>
            <span className="text-3xl font-mono font-bold text-orange-500 leading-none">
              {(room.timerLeft / 60 < 10 ? "0" : "") + Math.floor(room.timerLeft / 60)}:
              {(room.timerLeft % 60 < 10 ? "0" : "") + (room.timerLeft % 60)}
            </span>
          </div>

          <button 
            onClick={onLeave}
            className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-full transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">logout</span>
            방 나가기
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar: Participants */}
        <aside className="w-64 border-r border-slate-100 bg-white/50 p-6 flex flex-col gap-4 overflow-y-auto shrink-0">
          <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            참여 친구들 ({activeGroupStudents.length}/{groupStudents.length})
          </h2>
          
          {/* Participant Cards list */}
          <div className="space-y-3">
            {groupStudents.map((mate, idx) => {
              const isCurrentSpeaker = group.currentSpeaker === mate.name;
              const isSelf = mate.name === student.name;
              const statusEmoji = mate.name === student.name ? "🦊" : "🐰"; // simple friendly avatars
              
              return (
                <div 
                  key={`${mate.name}-${idx}`}
                  className={`p-3 bg-white rounded-2xl border-2 transition-all flex items-center gap-3 relative ${
                    isCurrentSpeaker 
                      ? "border-orange-400 shadow-md scale-[1.02]" 
                      : mate.active 
                      ? "border-slate-100 shadow-sm" 
                      : "border-slate-100 opacity-40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xl">
                    {statusEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">
                      {mate.name} {isSelf && "(나)"}
                    </p>
                    <p className={`text-[10px] font-bold ${isCurrentSpeaker ? "text-orange-500" : "text-slate-400"}`}>
                      {isCurrentSpeaker ? "📢 발표 중" : mate.active ? "대기 중" : "미입장"}
                    </p>
                  </div>
                  {isCurrentSpeaker && (
                    <div className="absolute -right-1 -top-1 w-3.5 h-3.5 bg-orange-400 rounded-full animate-pulse"></div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-auto p-4 bg-slate-800 rounded-2xl text-white">
            <p className="text-[10px] font-bold text-slate-400 mb-1.5 tracking-wide">패스 티켓 수량</p>
            <div className="flex gap-2">
              <div className={`w-8 h-5 rounded-md transition-colors ${group.passTickets >= 1 ? "bg-orange-400" : "bg-slate-600"}`}></div>
              <div className={`w-8 h-5 rounded-md transition-colors ${group.passTickets >= 2 ? "bg-orange-400" : "bg-slate-600"}`}></div>
            </div>
          </div>
        </aside>

        {/* Central Content Area */}
        <section className="flex-1 flex flex-col p-4 md:p-5 gap-3 md:gap-4 overflow-hidden">
          {/* STEP 0: LOBBY / 대기 중 */}
          {room.currentStepIndex === 0 && (
            <div className="flex-1 flex flex-col justify-center items-center text-center max-w-xl mx-auto space-y-6">
              <div className="relative">
                <MascotIcon character={room.character} size="xl" />
                <div className="absolute -top-3 -right-3 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-md animate-bounce">🎒</div>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                대기실에 오신 것을 환영합니다!
              </h2>
              <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100 w-full text-left space-y-2">
                <p className="text-slate-700 font-medium">
                  • {student.name} 친구는 <span className="text-orange-500 font-extrabold">{group.id}모둠</span>입니다.
                </p>
                <p className="text-slate-700 font-medium">
                  • 선생님께서 화면을 넘기실 때까지 친구들과 가볍게 대화하며 기다려 주세요.
                </p>
              </div>
            </div>
          )}

          {/* STEP 1: 토의 진행 (생각 카드 작성 & 발표자 추첨) */}
          {isQuestionStep && stageIndex === 0 && (
            <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
              {renderSpeechBubble(`"아래 질문을 잘 읽고 생각을 적어 카드(포스트잇)를 붙인 다음, 모둠 친구들과 함께 돌아가며 이야기를 나눠보자! 🎤"`)}

              {/* 토의 주제 표시 */}
              <div className="bg-orange-50/50 py-2.5 px-4 rounded-2xl border border-orange-100 text-center relative overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 bg-orange-100 text-orange-700 text-[9px] font-bold px-2 py-0.5 rounded-br-xl">토의 질문</div>
                <h3 className="text-lg font-bold text-slate-800 leading-tight mt-1">
                  "{room.questions && room.questions[currentQuestionIndex] ? room.questions[currentQuestionIndex] : room.topic}"
                </h3>
              </div>

              {/* 좌우 2단 구성 (발표자 추첨(좌) & 생각 카드 작성(우)) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch shrink-0">
                
                {/* 왼쪽: 발표자 추첨 (크기 축소) */}
                <div className="lg:col-span-5 flex flex-col">
                  {(room.questionsUseRandom === undefined || room.questionsUseRandom[currentQuestionIndex] !== false) ? (
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between min-h-[170px] h-full">
                      <div>
                        <span className="text-xs font-bold text-slate-500 block mb-2">발표 순서 정하기</span>
                        {isSpinning ? (
                          <div className="w-full bg-slate-900 border-4 border-amber-400 rounded-xl p-3 shadow-md relative overflow-hidden text-center space-y-2">
                            <div className="flex justify-between px-2">
                              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></span>
                              <span className="text-[9px] font-bold text-amber-400 tracking-widest">발표자 추첨 슬롯머신</span>
                              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></span>
                            </div>
                            <div className="bg-gradient-to-b from-slate-950 via-slate-800 to-slate-950 border-2 border-amber-500 rounded-lg h-14 flex items-center justify-center relative shadow-inner overflow-hidden">
                              <div className="absolute inset-x-0 h-0.5 bg-red-600/60 top-1/2 -translate-y-1/2 z-10"></div>
                              <div className="font-headline text-lg font-black text-amber-300 tracking-wider animate-bounce">
                                🎰 {displayedSpinnerName || "추첨 중..."}
                              </div>
                            </div>
                          </div>
                        ) : group.currentSpeaker === student.name ? (
                          <div className="w-full bg-amber-50 border-2 border-orange-400 p-4 rounded-xl text-center space-y-2 shadow-sm animate-scale-in">
                            <span className="material-symbols-outlined text-orange-500 text-3xl animate-bounce">mic</span>
                            <h3 className="text-sm font-black text-orange-800">내 발표 순서입니다! 🎤</h3>
                            <p className="text-[11px] text-slate-600 leading-normal">
                              모둠 친구들에게 내가 작성했던 의견 카드를 설명해 주세요.
                            </p>
                            <button
                              type="button"
                              onClick={onPassSpeaker}
                              disabled={group.passTickets <= 0}
                              className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] rounded-full shadow-sm disabled:opacity-40 transition-all mx-auto block"
                            >
                              다음 친구에게 양보하기 ({group.passTickets}장 있음)
                            </button>
                          </div>
                        ) : group.currentSpeaker ? (
                          <div className="w-full bg-slate-50 border border-slate-200 p-4 rounded-xl text-center space-y-2 shadow-sm animate-scale-in">
                            <span className="material-symbols-outlined text-orange-500 text-2xl animate-pulse">campaign</span>
                            <h3 className="text-sm font-bold text-slate-700">
                              현재 발표자: <span className="text-orange-500 font-extrabold">{group.currentSpeaker}</span>
                            </h3>
                            <p className="text-[10px] text-slate-400">
                              친구가 열심히 설명하는 동안 귀 기울여 들어볼까요? 👂
                            </p>
                            {group.drawnSpeakers.length === activeGroupStudents.length ? (
                              <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200 inline-block">
                                🎉 모든 모둠원이 발표를 완료했습니다!
                              </div>
                            ) : activeGroupStudents.length - group.drawnSpeakers.length === 1 ? (
                              <button
                                type="button"
                                onClick={onDrawSpeaker}
                                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold rounded-full shadow-sm animate-pulse mx-auto block"
                              >
                                마지막 발표자 확인하기 🎤
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={onDrawSpeaker}
                                className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-bold text-slate-600 rounded-full shadow-sm mx-auto block"
                              >
                                다음 발표자 또 뽑기 🎲
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="w-full bg-amber-500/10 border-2 border-amber-400/80 rounded-xl p-4 shadow-sm text-center space-y-2">
                            <div className="bg-white border border-amber-300 rounded-lg h-14 flex items-center justify-center shadow-inner">
                              <p className="font-headline text-sm font-black text-amber-800">
                                누가 발표해 볼까요?
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={onDrawSpeaker}
                              className="w-full h-9 bg-orange-500 hover:bg-orange-600 active:translate-y-0.5 text-white font-headline text-xs font-black rounded-full shadow-md transition-all flex items-center justify-center gap-1 border-b border-orange-700 mx-auto block"
                            >
                              {activeGroupStudents.length === 1 ? "🎤 발표자 확인하기" : "🎲 랜덤 추첨 슬롯 돌리기"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 발표 이력 */}
                      {group.drawnSpeakers.length > 0 && (
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2 text-left">
                          <span className="text-[9px] font-bold text-slate-400 block mb-1">발표 완료 친구 목록</span>
                          <div className="flex flex-wrap gap-1 items-center text-[9px]">
                            {group.drawnSpeakers.map((name, i) => (
                              <React.Fragment key={`${name}-${i}`}>
                                {i > 0 && <span className="text-slate-300">➡️</span>}
                                <span className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-600 shadow-xs">{name}</span>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-4 rounded-2xl flex flex-col justify-center items-center text-center h-full min-h-[170px] space-y-2">
                      <span className="material-symbols-outlined text-slate-400 text-3xl animate-pulse">forum</span>
                      <h4 className="font-headline text-xs font-bold text-slate-700">자유로운 생각 공유 시간</h4>
                      <p className="text-[10px] text-slate-500 leading-normal max-w-[200px]">
                        이 질문에는 발표 추첨기 기능이 꺼져 있습니다. 생각을 등록하고 자유롭게 대화하세요! 💬
                      </p>
                    </div>
                  )}
                </div>

                {/* 오른쪽: 생각 카드 작성 (크기 확대) */}
                <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500">생각 카드 적기</span>
                      <div className="flex items-center gap-1.5">
                        {isRecording && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping"></span>}
                        <span className="text-[10px] text-slate-400 font-bold">
                          {isRecording ? "말로 받아쓰는 중..." : sttLoading ? "수정 제안 분석 중..." : "직접 말하여 의견 작성을 시작해 보세요!"}
                        </span>
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-sans text-sm focus:bg-white focus:border-orange-400 outline-none transition-all h-20 resize-none"
                        placeholder="마이크 단추를 눌러서 말하거나, 직접 키보드로 의견을 입력해 보세요!"
                        value={postItText}
                        onChange={(e) => setPostItText(e.target.value)}
                        disabled={sttLoading}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400">배경:</span>
                      <div className="flex gap-1">
                        {stickyColors.map((col) => (
                          <button
                            key={col.hex}
                            type="button"
                            onClick={() => setPostItColor(col.hex)}
                            className={`w-6 h-6 rounded-md border transition-transform ${
                              postItColor === col.hex ? "border-slate-800 scale-110 shadow-xs" : "border-slate-200"
                            }`}
                            style={{ backgroundColor: col.hex }}
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePostItSubmit()}
                      disabled={!postItText.trim() || sttLoading}
                      className="h-10 px-5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-full shadow-sm flex items-center gap-1 transition-all text-xs"
                    >
                      <span className="material-symbols-outlined text-xs">sticky_note_2</span>
                      의견 제출
                    </button>
                  </div>
                </div>
              </div>

              {/* 실시간으로 모둠원들이 낸 의견 칠판 노출 (스크롤 가능하게 flex-1 설정) */}
              <div className="bg-slate-100/60 p-4 rounded-2xl border border-slate-200/50 space-y-2 flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                  <h4 className="font-headline text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-orange-500 text-xs">space_dashboard</span>
                    📢 우리 모둠 칠판 (실시간 의견 공유)
                  </h4>
                  <span className="text-[9px] text-slate-400 font-bold">제출된 포스트잇이 여기에 실시간으로 나타납니다.</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 overflow-y-auto flex-1 pr-1">
                  {group.postits.filter(p => p.questionId === currentQuestionIndex).length === 0 ? (
                    <div className="col-span-full py-6 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-xl bg-white/50 text-[10px]">
                      아직 등록된 의견 카드가 없습니다. 첫 의견을 등록해 보세요!
                    </div>
                  ) : (
                    group.postits.filter(p => p.questionId === currentQuestionIndex).map((p, i) => (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl shadow-sm border border-slate-200/40 flex flex-col justify-between h-20 transition-all hover:scale-[1.01]"
                        style={{ backgroundColor: p.color }}
                      >
                        <p className="text-slate-800 text-[11px] font-semibold font-sans leading-snug overflow-y-auto pr-1">
                          {p.text}
                        </p>
                        <div className="flex justify-between items-center mt-1 border-t border-black/5 pt-1 text-[8px] text-slate-500 font-bold shrink-0">
                          <span>작성자: {p.studentName}</span>
                          <span className="flex items-center gap-0.5">❤️ {p.likes}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 생각 모으기 (Bulletin Board with hearts) */}
          {isQuestionStep && stageIndex === 1 && (
            <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
              {renderSpeechBubble(`"우리 모둠 친구들이 제출한 의견 카드를 하나씩 찬찬히 읽어보고, 정말 마음에 들거나 공감하는 좋은 의견들에 하트(❤️)를 아낌없이 눌러주자!"`)}

              <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 pr-1 min-h-0">
                {group.postits.filter(p => p.questionId === currentQuestionIndex).length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50 text-xs">
                    아직 등록된 의견 카드가 없습니다.
                  </div>
                ) : (
                  group.postits.filter(p => p.questionId === currentQuestionIndex).map((p, i) => {
                    const rotClass = i % 2 === 0 ? "rotate-1" : "-rotate-1";
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl shadow-sm border border-slate-200/50 flex flex-col justify-between h-32 transition-transform hover:scale-[1.01] ${rotClass}`}
                        style={{ backgroundColor: p.color }}
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="px-2 py-0.5 bg-black/5 text-[9px] font-bold text-slate-700 rounded-full">
                              {p.studentName}
                            </span>
                            {p.studentName === student.name && (
                              <button
                                onClick={() => onDeletePostIt(p.id)}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                              </button>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-700 mt-1.5 leading-relaxed line-clamp-2">
                            "{p.text}"
                          </p>
                        </div>

                        <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-black/5 shrink-0">
                          <span className="text-[9px] text-slate-500 font-bold">
                            {p.sttCorrected && "🎤 음성 입력됨"}
                          </span>

                          <button
                            onClick={() => onLikePostIt(p.id)}
                            className="flex items-center gap-1 bg-white/80 hover:bg-white px-2.5 py-0.5 rounded-full text-[10px] font-bold text-rose-500 shadow-xs transition-transform active:scale-110"
                          >
                            <span className="material-symbols-outlined text-xs">favorite</span>
                            <span>{p.likes}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 4: 미니 투표 */}
          {/* STEP 4: 미니 투표 */}
          {room.hasVote && room.currentStepIndex === votingStepIndex && (
            <div className="space-y-6 flex-1 flex flex-col">
              {renderSpeechBubble(`"자! 실천가능성이 가장 훌륭한 카드 의견에 투표를 해볼 차례야! 모둠 최고의 명예는 누가 얻게 될까? 🗳️"`)}

              <div className="flex-1 flex flex-col justify-center">
                {group.activeVote?.active ? (
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-md space-y-6 max-w-lg mx-auto w-full">
                    <div className="text-center">
                      <span className="text-[10px] font-black text-orange-600 bg-orange-100/50 px-3 py-1 rounded-full uppercase tracking-wider">
                        VOTE SESSION
                      </span>
                      <h4 className="text-xl font-bold text-slate-800 mt-2.5">
                        {group.activeVote.question}
                      </h4>
                    </div>

                    {!userHasVoted ? (
                      <div className="space-y-2.5">
                        {group.activeVote.options.map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => onVote(opt.id)}
                            className="w-full text-left p-4 rounded-2xl bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-200 font-bold text-slate-700 transition-all text-sm flex items-center justify-between"
                          >
                            <span>👍 {opt.text}</span>
                            <span className="material-symbols-outlined text-orange-400 opacity-0 group-hover:opacity-100">chevron_right</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3.5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h5 className="text-xs font-bold text-slate-400">투표 실시간 수집 현황</h5>
                        <div className="space-y-2.5">
                          {group.activeVote.options.map((opt) => {
                            const total = group.activeVote?.votedStudents.length || 1;
                            const pct = Math.round((opt.count / total) * 100);
                            return (
                              <div key={opt.id} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                  <span>{opt.text}</span>
                                  <span className="text-orange-500">{opt.count}표 ({pct}%)</span>
                                </div>
                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                  <div className="bg-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center p-12 bg-white rounded-3xl border border-slate-100 max-w-sm mx-auto space-y-3 shadow-sm">
                    <span className="material-symbols-outlined text-slate-300 text-5xl">pending</span>
                    <p className="font-bold text-slate-500 text-sm">
                      선생님께서 실시간 투표를 시작해 주실 때까지 잠시 대기 중입니다!
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: 완료 (Done!) */}
          {/* STEP 5: 완료 (Done!) */}
          {room.currentStepIndex === maxStepIndex && (
            <div className="flex-1 flex flex-col justify-center items-center text-center max-w-xl mx-auto space-y-6 animate-scale-in">
              <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-3xl shadow-md animate-bounce">⭐</div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-800">모든 토의 완료! 🎉</h2>
                <p className="text-slate-500 leading-relaxed text-sm">
                  우리 모둠 친구들과 적극적으로 생각을 나누고, 소중한 결론을 만들어 냈습니다!
                </p>
              </div>

              {room.hasArtifact ? (
                /* Collaborative Artifact Text Editor */
                <div className="w-full bg-white p-6 rounded-3xl border-2 border-orange-200 shadow-md text-left space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-headline font-black text-slate-800 text-md flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-orange-500">assignment</span>
                      📝 우리 모둠 최종 산출물 (결론 협동 정리)
                    </h4>
                    <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                      키보드 타이핑 활성화됨
                    </span>
                  </div>

                  <p className="font-sans text-xs text-slate-500">
                    모둠 친구들과 머리를 맞대고 의논한 최종 결론을 아래 칠판에 멋지게 적어 보세요. 제출된 결론은 선생님 대시보드에 실시간으로 기록됩니다.
                  </p>

                  <textarea
                    value={artifactInput}
                    onChange={(e) => setArtifactInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-sans text-sm focus:bg-white focus:border-orange-400 outline-none transition-all h-28 resize-none"
                    placeholder="예: 이번 모둠 토의 결과, 우리는 학교에서 실천할 수 있는 가장 훌륭한 환경 보호 방법으로 '음식물 쓰레기 남기지 않기'와 '안 쓰는 전등 바로 끄기'를 최종 결론으로 선정하였습니다."
                  />

                  <button
                    type="button"
                    onClick={handleSaveArtifact}
                    disabled={isSavingArtifact}
                    className="w-full h-11 bg-orange-500 hover:bg-orange-600 active:translate-y-0.5 text-white font-headline text-xs font-black rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">cloud_upload</span>
                    {isSavingArtifact ? "저장 및 업로드 중..." : "💾 모둠 최종 결론 제출 및 실시간 저장"}
                  </button>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 max-w-sm w-full">
                  <p className="font-sans text-xs text-slate-500">
                    스마트 기기 조작을 마치고, 앞쪽 선생님 설명과 친구들 의견 발표에 집중해 주세요! 🙌
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Action Bar */}
      <footer className="h-[100px] bg-white border-t border-[#E5E5E5] flex items-center justify-between px-12 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onPassSpeaker}
            disabled={group.currentSpeaker !== student.name || group.passTickets <= 0}
            className={`flex flex-col items-center gap-1 transition-all ${
              group.currentSpeaker === student.name && group.passTickets > 0 ? "opacity-100 hover:scale-105" : "opacity-30 cursor-not-allowed"
            }`}
          >
            <div className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50">
              <span className="text-lg">⏩</span>
            </div>
            <span className="text-[10px] font-bold text-slate-600">패스하기</span>
          </button>

          <button 
            disabled={room.currentStepIndex !== votingStepIndex}
            className={`flex flex-col items-center gap-1 transition-all ${
              room.currentStepIndex === votingStepIndex ? "opacity-100 hover:scale-105" : "opacity-30 cursor-not-allowed"
            }`}
          >
            <div className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50">
              <span className="text-lg">🗳️</span>
            </div>
            <span className="text-[10px] font-bold text-slate-600">투표하기</span>
          </button>
        </div>

        {/* Central mic recording toggle button */}
        {isQuestionStep && stageIndex === 0 ? (
          (() => {
            const hasSubmittedPostIt = group?.postits.some((p) => p.studentName === student.name && p.questionId === currentQuestionIndex) || false;
            return (
              <button 
                type="button"
                onClick={handleStartSTT}
                disabled={sttLoading}
                className={`h-16 px-12 rounded-full shadow-lg flex items-center gap-4 transition-all duration-300 ${
                  isRecording 
                    ? "bg-rose-500 shadow-rose-200 text-white animate-pulse" 
                    : "bg-orange-500 shadow-orange-200 text-white hover:bg-orange-600 active:scale-95"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isRecording ? "bg-white text-rose-500" : "bg-white text-orange-500"}`}>
                  <span className="material-symbols-outlined text-lg">{isRecording ? "mic_off" : "mic"}</span>
                </div>
                <span className="text-white text-md font-bold">
                  {isRecording 
                    ? `음성 인식 중... (${recordingTimeLeft}초)` 
                    : sttLoading 
                    ? "제출 준비 중..." 
                    : hasSubmittedPostIt 
                    ? "추가 발언하기 (의견 추가)" 
                    : "말로 입력하기"}
                </span>
              </button>
            );
          })()
        ) : (
          <div className="text-slate-400 text-xs font-bold bg-slate-100 px-6 py-2.5 rounded-full flex items-center gap-1.5 border border-slate-200">
            <span className="material-symbols-outlined text-sm">lock</span>
            <span>작성 시간 외 마이크 잠금</span>
          </div>
        )}

        <div className="w-[150px] flex justify-end">
          <div className="flex -space-x-2.5 overflow-hidden">
            {activeGroupStudents.slice(0, 4).map((s, idx) => {
              const bgColors = ["bg-blue-400", "bg-emerald-400", "bg-purple-400", "bg-rose-400"];
              const bg = bgColors[idx % bgColors.length];
              return (
                <div 
                  key={`${s.name}-${idx}`}
                  className={`w-9 h-9 rounded-full ${bg} border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}
                >
                  {s.name.substring(0, 2)}
                </div>
              );
            })}
            {activeGroupStudents.length > 4 && (
              <div className="w-9 h-9 rounded-full bg-slate-600 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                +{activeGroupStudents.length - 4}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
