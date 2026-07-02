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

  // Slot-Machine Reel Animation States for presenter draw
  const [isSpinning, setIsSpinning] = useState(false);
  const [displayedSpinnerName, setDisplayedSpinnerName] = useState("");

  // Collaborative Artifact States
  const [artifactInput, setArtifactInput] = useState("");
  const [isSavingArtifact, setIsSavingArtifact] = useState(false);

  const group = room.groups.find((g) => g.id === student.groupId) as Group;

  useEffect(() => {
    if (group?.artifactText !== undefined) {
      setArtifactInput(group.artifactText);
    }
  }, [group?.artifactText]);

  const handleSaveArtifact = async () => {
    setIsSavingArtifact(true);
    try {
      await fetch(`/api/rooms/${room.roomId}/group/${student.groupId}/artifact`, {
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
      const teammates = room.students.filter((s) => s.groupId === student.groupId && s.active);
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
      // Stop recording
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = "ko-KR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => {
      setIsRecording(true);
    };

    rec.onerror = (e: any) => {
      console.error(e);
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.onresult = async (event: any) => {
      const resultText = event.results[0][0].transcript;
      if (!resultText) return;

      setIsRecording(false);
      setSttLoading(true);

      // Post to server for Gemini typo & grammar correction!
      try {
        const res = await fetch(`/api/rooms/${room.roomId}/stt-correct`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: resultText }),
        });
        const data = await res.json();
        setPostItText((prev) => (prev ? prev + " " + data.correctedText : data.correctedText));
      } catch (err) {
        // Fallback to raw text
        setPostItText((prev) => (prev ? prev + " " + resultText : resultText));
      } finally {
        setSttLoading(false);
      }
    };

    recognitionRef.current = rec;
    rec.start();
  };

  const handlePostItSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!postItText.trim()) return;
    onPostIt(postItText, postItColor);
    setPostItText("");
  };

  if (!group) return null;

  // Active vote verification
  const userHasVoted = group.activeVote?.votedStudents.includes(student.name) || false;

  // Filter classmates of the active group
  const groupStudents = room.students.filter((s) => s.groupId === student.groupId);
  const activeGroupStudents = groupStudents.filter((s) => s.active);

  // Reusable Facilitator Speech Bubble helper
  const renderSpeechBubble = (text: string) => {
    return (
      <div className="flex gap-6 items-start">
        <div className="shrink-0 w-24 h-24 bg-white rounded-3xl shadow-lg flex flex-col items-center justify-center border-4 border-white overflow-hidden relative">
          <div className="w-full h-2/3 bg-orange-100 flex items-center justify-center overflow-hidden">
            <MascotIcon character={room.character} size="sm" className="scale-110 border-none shadow-none bg-transparent" />
          </div>
          <div className="w-full h-1/3 bg-orange-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white uppercase tracking-tight">사회자 {room.characterName}</span>
          </div>
        </div>
        <div className="flex-1 bg-white p-6 rounded-3xl shadow-md border border-slate-100 relative">
          <div className="absolute -left-3 top-8 w-6 h-6 bg-white rotate-45 border-l border-b border-slate-100"></div>
          <p className="font-sans text-slate-700 text-md leading-relaxed font-medium">
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
              Group {student.groupId} • Room #{room.roomId}
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
        <section className="flex-1 flex flex-col p-8 gap-8 overflow-y-auto">
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
                  • {student.name} 친구는 <span className="text-orange-500 font-extrabold">{student.groupId}모둠</span>입니다.
                </p>
                <p className="text-slate-700 font-medium">
                  • 선생님께서 화면을 넘기실 때까지 친구들과 가볍게 대화하며 기다려 주세요.
                </p>
              </div>
            </div>
          )}

          {/* STEP 1: 생각 정리 (Thinking & Write Card) */}
          {room.currentStepIndex === 1 && (
            <div className="space-y-6 flex-1 flex flex-col">
              {renderSpeechBubble(`"오늘의 핵심 질문에 대해 조용히 생각을 적어보는 시간이야! 떠오른 생각을 아래 칠판에 붙여보자! 💡"`)}

              {/* Discussion Question display */}
              <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 bg-orange-100 text-orange-700 text-[10px] font-bold px-3 py-1 rounded-br-2xl">DISCUSSION TOPIC</div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight mt-2">
                  "{room.topic}"
                </h3>
              </div>

              {/* Opinion Input Form */}
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500">생각 카드 적기</span>
                  <div className="flex items-center gap-1.5">
                    {isRecording && <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>}
                    <span className="text-xs text-slate-400 font-bold">
                      {isRecording ? "말로 받아쓰는 중..." : sttLoading ? "수정 제안 분석 중..." : "직접 말하여 의견 작성을 시작해 보세요!"}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-sans text-md focus:bg-white focus:border-orange-400 outline-none transition-all h-28 resize-none"
                    placeholder="먼저 아래 [말로 입력하기] 마이크 단추를 눌러 생각을 이야기해 주세요. 그 다음 여기에 키보드로 수정할 수 있습니다."
                    value={postItText}
                    onChange={(e) => setPostItText(e.target.value)}
                    disabled={sttLoading || !postItText}
                  />

                  {!postItText && (
                    <div className="absolute inset-0 bg-slate-50/95 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-4 text-center space-y-2 pointer-events-none">
                      <span className="material-symbols-outlined text-orange-500 text-3xl animate-pulse">mic_none</span>
                      <p className="font-headline font-extrabold text-sm text-slate-800">
                        🎙️ 음성 인식으로 의견 작성을 시작해 보세요!
                      </p>
                      <p className="font-sans text-[11px] text-slate-400">
                        (말하기가 완료되면 자판으로 마음껏 고쳐 쓸 수 있어요)
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">배경 색상:</span>
                    <div className="flex gap-1.5">
                      {stickyColors.map((col) => (
                        <button
                          key={col.hex}
                          type="button"
                          onClick={() => setPostItColor(col.hex)}
                          className={`w-7 h-7 rounded-lg border transition-transform ${
                            postItColor === col.hex ? "border-slate-800 scale-110 shadow-sm" : "border-slate-200"
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
                    className="h-12 px-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold rounded-full shadow-md flex items-center gap-1.5 transition-all text-sm"
                  >
                    <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                    의견 제출하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: 발표자 뽑기 (Draw presenter slot machine) */}
          {room.currentStepIndex === 2 && (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              {renderSpeechBubble(`"모둠 발표자를 정해볼 시간이야! 아래 추천기를 통해 순서를 정해보자. 친구 차례가 오면 마이크에 경청해 줘! 🎤"`)}

              <div className="flex-1 flex flex-col justify-center items-center my-4">
                {isSpinning ? (
                  /* 🎰 SLOT MACHINE SPINNING REEL STATE */
                  <div className="max-w-md w-full bg-slate-900 border-4 border-amber-400 rounded-3xl p-6 shadow-2xl relative overflow-hidden text-center space-y-4">
                    {/* Flashing Neon Header */}
                    <div className="flex justify-between px-2">
                      <span className="w-3.5 h-3.5 bg-yellow-400 rounded-full animate-ping"></span>
                      <span className="text-[11px] font-headline font-black text-amber-400 tracking-widest uppercase">SPEAKER SLOT MACHINE</span>
                      <span className="w-3.5 h-3.5 bg-yellow-400 rounded-full animate-ping"></span>
                    </div>

                    {/* Mechanical Reel Display */}
                    <div className="bg-gradient-to-b from-slate-950 via-slate-800 to-slate-950 border-4 border-amber-500 rounded-2xl h-28 flex items-center justify-center relative shadow-inner overflow-hidden">
                      <div className="absolute inset-x-0 h-0.5 bg-red-600/60 top-1/2 -translate-y-1/2 z-10 shadow-sm"></div>
                      <div className="font-headline text-3xl font-black text-amber-300 tracking-wider animate-bounce">
                        🎰 {displayedSpinnerName || "추첨 중..."}
                      </div>
                    </div>

                    <p className="font-headline font-bold text-xs text-amber-400 animate-pulse">
                      선생님과 친구들의 화면에 실시간으로 돌고 있어요! 두근두근!
                    </p>
                  </div>
                ) : group.currentSpeaker === student.name ? (
                  /* 🎤 MY TURN STATE */
                  <div className="max-w-md w-full bg-amber-50 border-2 border-orange-400 p-8 rounded-3xl text-center space-y-4 shadow-xl animate-scale-in">
                    <span className="material-symbols-outlined text-orange-500 text-6xl animate-bounce">mic</span>
                    <h3 className="text-2xl font-black text-orange-800">내 발표 순서입니다! 🎤</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      모둠 친구들에게 내가 작성했던 의견 카드를 소리내어 또박또박 설명해 주세요.
                    </p>
                    <button
                      type="button"
                      onClick={onPassSpeaker}
                      disabled={group.passTickets <= 0}
                      className="px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-full shadow-sm disabled:opacity-40 transition-all"
                    >
                      다음 친구에게 양보하기 ({group.passTickets}장 있음)
                    </button>
                  </div>
                ) : group.currentSpeaker ? (
                  /* 🔊 CLASSMATE TURN STATE */
                  <div className="max-w-md w-full bg-slate-50 border border-slate-200 p-8 rounded-3xl text-center space-y-4 animate-scale-in">
                    <span className="material-symbols-outlined text-orange-500 text-5xl animate-pulse">campaign</span>
                    <h3 className="text-xl font-bold text-slate-700">
                      현재 발표자: <span className="text-orange-500 font-extrabold">{group.currentSpeaker}</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      친구가 열심히 설명하는 동안 집중해서 귀 기울여 들어볼까요? 👂
                    </p>
                    <button
                      type="button"
                      onClick={onDrawSpeaker}
                      className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 rounded-full shadow-sm"
                    >
                      다음 발표자 또 뽑기 🎲
                    </button>
                  </div>
                ) : (
                  /* 🎲 IDLE / INITIAL SLOT MACHINE CABINET WITH PULL LEVER */
                  <div className="max-w-md w-full bg-amber-500/10 border-4 border-amber-400/80 rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-6 items-center">
                    
                    {/* Machine Body */}
                    <div className="flex-1 text-center space-y-4 w-full">
                      <div className="flex justify-center gap-1.5 mb-1">
                        {[1, 2, 3, 4, 5].map((idx) => (
                          <span key={idx} className="w-2 h-2 bg-amber-400 rounded-full animate-ping" style={{ animationDelay: `${idx * 150}ms` }} />
                        ))}
                      </div>

                      <div className="bg-white border-2 border-amber-400 rounded-2xl h-24 flex items-center justify-center shadow-inner">
                        <p className="font-headline text-xl font-black text-amber-800 tracking-tight">
                          누가 발표해 볼까요?
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={onDrawSpeaker}
                        className="w-full h-12 bg-orange-500 hover:bg-orange-600 active:translate-y-0.5 text-white font-headline text-sm font-black rounded-full shadow-md transition-all flex items-center justify-center gap-1.5 border-b-2 border-orange-700"
                      >
                        🎲 랜덤 추첨 슬롯 돌리기
                      </button>
                    </div>

                    {/* Pull Lever Widget (Interactive representation) */}
                    <div className="hidden sm:flex flex-col items-center justify-center pr-2 shrink-0">
                      <div className="w-5 h-20 bg-slate-300 border-2 border-slate-400 rounded-full relative flex items-start justify-center cursor-pointer hover:bg-slate-200" onClick={onDrawSpeaker}>
                        <div className="w-1.5 h-12 bg-slate-400 rounded-full"></div>
                        <div className="w-8 h-8 bg-rose-600 hover:bg-rose-500 rounded-full border-2 border-rose-700 absolute -top-4 shadow-md transition-transform active:translate-y-12"></div>
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold mt-2">레버 당기기</span>
                    </div>

                  </div>
                )}
              </div>

              {group.drawnSpeakers.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 mb-2">발표 완료 친구 목록</h4>
                  <div className="flex flex-wrap gap-2 items-center text-xs">
                    {group.drawnSpeakers.map((name, i) => (
                      <React.Fragment key={`${name}-${i}`}>
                        {i > 0 && <span className="text-slate-300">➡️</span>}
                        <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-600 shadow-sm">{name}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: 생각 모으기 (Bulletin Board with hearts) */}
          {room.currentStepIndex === 3 && (
            <div className="space-y-6 flex-1 flex flex-col">
              {renderSpeechBubble(`"모둠 친구들이 낸 의견이 칠판에 모두 모였어! 하나씩 정성스레 읽어보고 정말 훌륭한 아이디어에 아낌없이 하트(❤️)를 눌러주자!"`)}

              <div className="flex-1 grid grid-cols-2 gap-4">
                {group.postits.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-slate-400 font-medium border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                    아직 등록된 의견 카드가 없습니다.
                  </div>
                ) : (
                  group.postits.map((p, i) => {
                    const rotClass = i % 2 === 0 ? "rotate-1" : "-rotate-1";
                    return (
                      <div
                        key={p.id}
                        className={`p-6 rounded-3xl shadow-sm border border-slate-200/50 flex flex-col justify-between h-40 transition-transform hover:scale-[1.01] ${rotClass}`}
                        style={{ backgroundColor: p.color }}
                      >
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="px-2.5 py-0.5 bg-black/5 text-[10px] font-bold text-slate-700 rounded-full">
                              {p.studentName}
                            </span>
                            {p.studentName === student.name && (
                              <button
                                onClick={() => onDeletePostIt(p.id)}
                                className="text-slate-400 hover:text-rose-600 transition-colors"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-700 mt-2.5 leading-relaxed line-clamp-2">
                            "{p.text}"
                          </p>
                        </div>

                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-black/5">
                          <span className="text-[10px] text-slate-500 font-bold">
                            {p.sttCorrected && "🎤 음성 입력됨"}
                          </span>

                          <button
                            onClick={() => onLikePostIt(p.id)}
                            className="flex items-center gap-1.5 bg-white/80 hover:bg-white px-3 py-1 rounded-full text-xs font-bold text-rose-500 shadow-sm transition-transform active:scale-110"
                          >
                            <span className="material-symbols-outlined text-sm">favorite</span>
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
          {room.currentStepIndex === 4 && (
            <div className="space-y-6 flex-1 flex flex-col">
              {renderSpeechBubble(`"자! 실천가능성이 가장 훌륭한 카드 의견에 투표를 해볼 차례야! 모둠 최고의 명예는 누가 얻게 될까?"`)}

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
          {room.currentStepIndex === 5 && (
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
            disabled={room.currentStepIndex !== 4}
            className={`flex flex-col items-center gap-1 transition-all ${
              room.currentStepIndex === 4 ? "opacity-100 hover:scale-105" : "opacity-30 cursor-not-allowed"
            }`}
          >
            <div className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center bg-slate-50">
              <span className="text-lg">🗳️</span>
            </div>
            <span className="text-[10px] font-bold text-slate-600">투표하기</span>
          </button>
        </div>

        {/* Central mic recording toggle button */}
        {room.currentStepIndex === 1 ? (
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
              {isRecording ? "음성 인식 중..." : sttLoading ? "제출 준비 중..." : "말로 입력하기"}
            </span>
          </button>
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
