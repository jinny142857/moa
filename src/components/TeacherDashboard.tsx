import React, { useState } from "react";
import { RoomState, Group } from "../types";
import MascotIcon from "./MascotIcon";

interface TeacherDashboardProps {
  room: RoomState;
  onStepChange: (step: number) => void;
  onQuietModeToggle: (active: boolean) => void;
  onTriggerAlert: (groupId: string | number, type: "encourage" | "warning", msg: string) => void;
  onTimerToggle: (active: boolean) => void;
  onTimerReset: (duration?: number) => void;
  onResetRoom: () => void;
  teacherUser?: { name: string; email: string; picture?: string } | null;
  onUpdateRoom?: (config: {
    topic: string;
    character: string;
    studentNames: string[];
    stepPrompts: string[];
    hasArtifact: boolean;
    groupCount: number;
    questions?: string[];
    hasVote?: boolean;
  }) => Promise<void>;
  onBack?: () => void;
}

export default function TeacherDashboard({
  room,
  onStepChange,
  onQuietModeToggle,
  onTriggerAlert,
  onTimerToggle,
  onTimerReset,
  onResetRoom,
  teacherUser,
  onUpdateRoom,
  onBack,
}: TeacherDashboardProps) {
  const [activeTab, setActiveTab] = useState<"dashboard" | "lobby" | "board">("dashboard");

  // Dynamic calculations based on questions count and hasVote option
  const questionsCount = room.questions?.length || 1;
  const maxStepIndex = questionsCount * 3 + (room.hasVote ? 1 : 0) + 1;

  // Sum of postits across all groups
  const totalPostIts = room.groups.reduce((acc, g) => acc + g.postits.length, 0);

  // Active student count
  const activeStudents = room.students.filter((s) => s.active).length;
  const totalStudents = room.students.length;

  const getStepDescription = (stepIndex: number) => {
    if (stepIndex === 0) return "로비 대기";
    if (stepIndex >= 1 && stepIndex <= questionsCount * 3) {
      const qIdx = Math.floor((stepIndex - 1) / 3);
      const stageIdx = (stepIndex - 1) % 3;
      const stageName = ["생각 시간", "발표 추첨", "의견 모으기"][stageIdx];
      return `Q${qIdx + 1}: ${stageName}`;
    }
    if (room.hasVote && stepIndex === questionsCount * 3 + 1) {
      return "미니 투표";
    }
    return "토의 종료";
  };

  // Calculate avg mood dynamically
  const getAverageMood = () => {
    if (totalPostIts > 15) return { text: "최고!", emoji: "🌟" };
    if (totalPostIts > 5) return { text: "좋음!", emoji: "🔥" };
    return { text: "시작 중!", emoji: "🌱" };
  };
  const mood = getAverageMood();

  // Next step click handler
  const handleNextStep = () => {
    if (room.currentStepIndex < maxStepIndex) {
      onStepChange(room.currentStepIndex + 1);
    } else {
      alert("이미 마지막 단계입니다!");
    }
  };

  const handlePrevStep = () => {
    if (room.currentStepIndex > 0) {
      onStepChange(room.currentStepIndex - 1);
    }
  };

  // Export Room session data to Excel-compatible UTF-8 BOM CSV
  const handleExportData = () => {
    let csvContent = "\uFEFF"; // Add UTF-8 BOM for correct Korean excel encoding
    csvContent += "모두모아 (MOA) 토의 결과 보고서\n";
    csvContent += `토의 대주제: ${room.topic}\n`;
    csvContent += `방 코드: ${room.roomId}\n`;
    csvContent += `다운로드 시간: ${new Date().toLocaleString()}\n\n`;

    // Section 1: Groups Summary
    csvContent += "--- 모둠별 활동 요약 ---\n";
    csvContent += "모둠명,현재 단계,발생 포스트잇 수,남은 패스 티켓,최종 스피커 목록\n";
    room.groups.forEach((g) => {
      csvContent += `${g.name},${g.phase},${g.postits.length}개,${g.passTickets}개,${g.drawnSpeakers.join(" > ") || "없음"}\n`;
    });
    csvContent += "\n";

    // Section 2: Detailed Post-its list
    csvContent += "--- 학생별 등록 의견 (포스트잇 데이터) ---\n";
    csvContent += "모둠명,학생 이름,질문 구분,의견 내용,받은 격려 하트 수,음성인식 여부\n";
    room.groups.forEach((g) => {
      g.postits.forEach((p) => {
        // Remove commas to prevent CSV breaking
        const sanitizedText = p.text.replace(/,/g, " ");
        const qText = p.questionId !== undefined && room.questions && room.questions[p.questionId]
          ? `Q${p.questionId + 1}: ${room.questions[p.questionId]}`
          : "기타";
        csvContent += `${g.name},${p.studentName},"${qText}","${sanitizedText}",${p.likes}개,${p.sttCorrected ? "네(STT)" : "아니오(자판)"}\n`;
      });
    });
    csvContent += "\n";

    // Section 3: Vote Results
    csvContent += "--- 투표 진행 결과 ---\n";
    csvContent += "모둠명,투표 질문,선택지,득표수\n";
    room.groups.forEach((g) => {
      if (g.activeVote) {
        g.activeVote.options.forEach((opt) => {
          csvContent += `${g.name},"${g.activeVote?.question}",${opt.text},${opt.count}표\n`;
        });
      } else {
        csvContent += `${g.name},투표 내역 없음,,\n`;
      }
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MOA_토의결과_${room.roomId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert timer seconds to MM:SS string
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Dynamic left borders depending on group id
  const groupBorders = [
    "border-l-sky-500",
    "border-l-emerald-500",
    "border-l-rose-500",
    "border-l-amber-500",
    "border-l-indigo-500",
    "border-l-teal-500",
  ];

  return (
    <div className="flex h-screen bg-[#FDFCF8] overflow-hidden">
      {/* SideNavBar */}
      <nav className="hidden md:flex flex-col h-full w-64 bg-white border-r-2 border-[#E5E5E5] py-6 shrink-0">
        <div className="px-6 mb-8 flex flex-col items-center">
          <div className="mb-4 flex items-center gap-2">
            <span className="font-headline text-3xl font-black text-secondary-brand tracking-tighter">
              MOA
            </span>
          </div>
          <MascotIcon character={room.character} size="md" className="mb-2" />
          <h2 className="font-headline text-xl font-black text-slate-800 text-center">
            {room.topic.length > 15 ? `${room.topic.substring(0, 15)}...` : room.topic}
          </h2>
          <p className="font-sans text-xs text-slate-400 mt-1">
            {room.currentStepIndex === 0
              ? "현재 단계: 대기 중"
              : `${room.currentStepIndex}단계: ${getStepDescription(room.currentStepIndex)}`}
          </p>
        </div>

        <div className="flex-1 space-y-2 px-2">
          {/* Active Tab: Dashboard */}
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 rounded-xl font-headline font-bold px-4 py-3 hover:scale-[1.02] transition-transform ${
              activeTab === "dashboard"
                ? "bg-primary-container text-on-primary-container"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined">monitoring</span>
            <span>대시보드</span>
          </button>

          <button
            onClick={() => setActiveTab("lobby")}
            className={`w-full flex items-center gap-3 rounded-xl font-headline font-bold px-4 py-3 hover:scale-[1.02] transition-transform ${
              activeTab === "lobby"
                ? "bg-primary-container text-on-primary-container"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined">group</span>
            <span>로비 & 학생현황</span>
          </button>
        </div>

        <div className="px-4 pb-4 mt-auto space-y-2">
          <button
            onClick={onResetRoom}
            className="w-full chunky-button bg-primary-container text-on-primary-container font-headline py-3 rounded-xl font-bold flex items-center justify-center gap-2 border-b-4 border-amber-600"
          >
            <span className="material-symbols-outlined">refresh</span>
            새 주제로 빌드
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="w-full border-2 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-headline py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              처음 화면으로
            </button>
          )}
        </div>
      </nav>

      {/* Main Content Scrollable Area */}
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Top Header Control Bar */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all flex items-center justify-center"
                title="처음 화면으로"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
            )}
            <h1 className="font-headline text-2xl font-black text-slate-800">
              선생님 실시간 관제 대시보드
            </h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span>실시간 연동 활성</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quiet Mode Button */}
            <button
              onClick={() => onQuietModeToggle(!room.isQuietMode)}
              className={`chunky-button px-4 py-2 rounded-full flex items-center gap-2 font-headline font-bold text-sm transition-all ${
                room.isQuietMode
                  ? "bg-rose-600 text-white border-b-4 border-rose-800 animate-pulse"
                  : "bg-slate-800 text-white border-b-4 border-slate-950"
              }`}
            >
              <span className="material-symbols-outlined text-sm">pause_circle</span>
              {room.isQuietMode ? "쉿! 모드 작동 중 ⏸️" : "쉿! 모드 (조용히!) ⏸️"}
            </button>

            {/* Timer Controller */}
            <div className="bg-slate-100 px-4 py-1.5 rounded-full flex items-center gap-2 border border-slate-200 font-headline text-sm">
              <span className="material-symbols-outlined text-slate-600">timer</span>
              <span className="font-black text-slate-800">{formatTime(room.timerLeft)}</span>
              <button
                onClick={() => onTimerToggle(!room.timerActive)}
                className="text-primary-brand hover:scale-110 active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined text-md">
                  {room.timerActive ? "pause" : "play_arrow"}
                </span>
              </button>
              <button
                onClick={() => onTimerReset()}
                className="text-slate-500 hover:scale-110 active:scale-90 transition-transform"
              >
                <span className="material-symbols-outlined text-md">replay</span>
              </button>
            </div>

            {/* Step Controls */}
            <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
              <button
                onClick={handlePrevStep}
                disabled={room.currentStepIndex === 0}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white text-slate-600 disabled:opacity-30 transition-colors"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <span className="font-headline font-bold text-xs px-2 text-slate-800">
                {room.currentStepIndex}/{maxStepIndex}단계
              </span>
              <button
                onClick={handleNextStep}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-container text-on-primary-container hover:bg-amber-300 font-bold transition-colors"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>

            <div className="bg-amber-50 border border-primary-container text-on-primary-container font-headline font-bold px-4 py-2 rounded-full text-sm">
              방 코드: <span className="font-black text-primary-brand">{room.roomId}</span>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        {activeTab === "dashboard" && (
          <div className="p-6 space-y-6">
            {/* Bento-style Stats Overview */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-sky-50/40 border border-sky-100/80 p-6 rounded-2xl flex justify-between items-center shadow-sm">
                <div>
                  <h3 className="font-headline font-bold text-sky-800 mb-1">참여 학생 현황</h3>
                  <p className="font-headline text-4xl font-black text-sky-900">
                    {activeStudents} / {totalStudents} 명
                  </p>
                </div>
                <span className="material-symbols-outlined text-sky-600 text-5xl opacity-40">
                  school
                </span>
              </div>

              <div className="bg-emerald-50/40 border border-emerald-100/80 p-6 rounded-2xl flex justify-between items-center shadow-sm">
                <div>
                  <h3 className="font-headline font-bold text-emerald-800 mb-1">
                    전체 등록 포스트잇
                  </h3>
                  <p className="font-headline text-4xl font-black text-emerald-900">
                    {totalPostIts} 개
                  </p>
                </div>
                <span className="material-symbols-outlined text-emerald-600 text-5xl opacity-40">
                  note_alt
                </span>
              </div>

              <div className="bg-orange-50/40 border border-orange-100/80 p-6 rounded-2xl flex justify-between items-center shadow-sm">
                <div>
                  <h3 className="font-headline font-bold text-orange-700 mb-1">학습 분위기</h3>
                  <div className="flex items-center gap-2">
                    <p className="font-headline text-4xl font-black text-orange-900">
                      {mood.text}
                    </p>
                    <span className="text-3xl">{mood.emoji}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-orange-500 text-5xl opacity-40">
                  celebration
                </span>
              </div>
            </section>

            {/* Step Sequence Guide banner */}
            <section className="bg-slate-100 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-2 items-center justify-between text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500">info</span>
                <span className="font-bold text-slate-800">
                  수업 단계 동기화: {getStepDescription(room.currentStepIndex)}
                </span>
              </div>
              <div className="flex items-center gap-2 font-headline font-bold flex-wrap">
                {Array.from({ length: maxStepIndex + 1 }).map((_, i) => (
                  <span
                    key={i}
                    className={`${
                      room.currentStepIndex === i ? "text-primary-brand underline" : "text-slate-400"
                    }`}
                  >
                    {i === 0 ? "로비" : getStepDescription(i)}
                    {i < maxStepIndex && " ➡️ "}
                  </span>
                ))}
              </div>
            </section>

            {/* Active Character Prompt Bubbles for Teacher */}
            {room.currentStepIndex >= 1 && room.currentStepIndex <= questionsCount * 3 && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3.5 text-slate-700 opinion-card animate-scale-in">
                <MascotIcon character={room.character} size="sm" className="shrink-0" />
                <div className="space-y-1 text-left">
                  <span className="block text-xs font-bold text-amber-800">💬 현재 {room.characterName} 사회자가 학생에게 띄우는 발문</span>
                  <p className="font-sans text-sm font-bold text-slate-800 leading-relaxed">
                    {(() => {
                      const qIdx = Math.floor((room.currentStepIndex - 1) / 3);
                      const currentQ = room.questions && room.questions[qIdx] ? room.questions[qIdx] : room.topic;
                      const stageIdx = (room.currentStepIndex - 1) % 3;
                      if (stageIdx === 0) return `"${currentQ}" 주제에 대해 생각을 카드에 적어 붙여보자! 💡`;
                      if (stageIdx === 1) return `"${currentQ}" 의견 발표자를 추천기로 정해서 생각을 나눠보자! 🎤`;
                      return `친구들의 "${currentQ}" 카드 중 마음에 드는 좋은 의견에 하트를 눌러보자! ❤️`;
                    })()}
                  </p>
                </div>
              </div>
            )}

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {room.groups.map((group, idx) => {
                const groupBorder = groupBorders[idx] || "border-l-slate-400";
                
                // Determine custom badge state
                const isWarningState = group.alertType === "warning" || group.activityLevel === "low";

                // Filter group postits for the current question if in a question step
                const currentQuestionIndex = room.currentStepIndex >= 1 && room.currentStepIndex <= questionsCount * 3
                  ? Math.floor((room.currentStepIndex - 1) / 3)
                  : null;

                const filteredPostIts = currentQuestionIndex !== null
                  ? group.postits.filter(p => p.questionId === currentQuestionIndex)
                  : group.postits;

                return (
                  <div
                    key={group.id}
                    className={`opinion-card rounded-2xl bg-white p-6 flex flex-col gap-4 border-l-[8px] ${groupBorder} ${
                      isWarningState ? "ring-2 ring-rose-500/20 bg-rose-50/5" : ""
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-headline text-2xl font-black text-slate-800">
                            {group.name}
                          </h2>
                          {isWarningState && (
                            <span className="material-symbols-outlined text-rose-500 animate-bounce">
                              priority_high
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-block px-3 py-1 text-xs font-bold rounded-full mt-1 uppercase tracking-wider ${
                            isWarningState
                              ? "bg-rose-100 text-rose-600"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {isWarningState ? "활동 없음 (3분)" : group.phase}
                        </span>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-500">groups</span>
                      </div>
                    </div>

                    {/* Status Info box */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 text-sm font-sans">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">현재 발표자:</span>
                        <span className="font-bold flex items-center gap-1">
                          {group.currentSpeaker ? (
                            <>
                              <span className="material-symbols-outlined text-sm text-secondary-brand">
                                mic
                              </span>
                              <span className="text-secondary-brand">{group.currentSpeaker}</span>
                            </>
                          ) : (
                            <span className="text-slate-400 italic">조용함 (대기)</span>
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">현재 질문 제출:</span>
                        <span className="font-bold text-slate-800">{filteredPostIts.length} 개</span>
                      </div>
                    </div>

                    {/* Mini Board Preview */}
                    <div className="h-44 bg-slate-50 border border-slate-200/80 rounded-xl relative overflow-hidden flex flex-col p-2.5 shadow-inner">
                      <div className="absolute top-1.5 right-2 text-[9px] text-slate-400 font-bold z-10 bg-slate-50/80 px-1.5 rounded">
                        실시간 모둠 칠판 내용
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1.5 mt-4 pr-1 text-left">
                        {filteredPostIts.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-xs text-slate-400 font-bold font-sans">의견 작성 대기중</div>
                        ) : (
                          filteredPostIts.map((p) => (
                            <div
                              key={p.id}
                              className="p-2.5 rounded-lg shadow-sm border border-black/5 text-[11px] leading-relaxed text-slate-800 font-bold font-sans"
                              style={{ backgroundColor: p.color }}
                            >
                              <div className="flex justify-between items-center text-[9px] text-slate-500 font-extrabold mb-1 border-b border-black/5 pb-0.5">
                                <span>{p.studentName}</span>
                                <span>❤️ {p.likes}</span>
                              </div>
                              <p className="whitespace-pre-wrap break-all">{p.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Collaborative Artifact display if enabled */}
                    {room.hasArtifact && (
                      <div className="bg-amber-50/50 border border-amber-200/60 rounded-xl p-3 text-xs font-sans space-y-1 text-left">
                        <span className="font-bold text-amber-800 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">assignment</span>
                          📝 모둠 최종 결론 (산출물)
                        </span>
                        {group.artifactText ? (
                          <p className="text-slate-700 leading-normal bg-white p-2 rounded-lg border border-slate-200/40 font-medium">
                            "{group.artifactText}"
                          </p>
                        ) : (
                          <p className="text-slate-400 italic">아직 작성 전 또는 작성 중...</p>
                        )}
                      </div>
                    )}

                    {/* Remote Master controls */}
                    <div className="flex gap-2 mt-auto">
                      <button
                        onClick={() =>
                          onTriggerAlert(
                            group.id,
                            "encourage",
                            "칭찬 카드 도착! 너희들 의견이 정말 멋지구나! 계속해서 이야기해 보자! 🎉"
                          )
                        }
                        className="flex-1 chunky-button bg-primary-container text-on-primary-container py-2.5 rounded-xl text-xs font-headline font-black flex items-center justify-center gap-1 border-b-2 border-amber-600 hover:bg-amber-300"
                      >
                        <span className="material-symbols-outlined text-sm">celebration</span>
                        격려하기
                      </button>

                      <button
                        onClick={() =>
                          onTriggerAlert(
                            group.id,
                            "warning",
                            "쉿! 조용조용! 모둠 친구들과 소리를 조금 낮추고 의견을 골고루 나누어 볼까?"
                          )
                        }
                        className="flex-1 border-2 border-rose-200 text-rose-600 hover:bg-rose-50 py-2.5 rounded-xl text-xs font-headline font-black flex items-center justify-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">warning</span>
                        주의 주기
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Export Section */}
            <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 opinion-card">
              <div>
                <h3 className="font-headline text-lg font-bold text-secondary-brand">
                  📊 과정 중심 토의 기록 관리 및 산출물 내보내기
                </h3>
                <p className="font-sans text-sm text-slate-500 mt-1">
                  모든 모둠의 작성 카드, 투표 결과, 발표자 로그가 포함된 보고서 시트를 정형화 다운로드할 수 있습니다.
                </p>
              </div>
              <button
                onClick={handleExportData}
                className="chunky-button bg-slate-800 text-white font-headline font-bold px-6 py-3 rounded-xl border-b-4 border-slate-950 flex items-center gap-2 hover:bg-slate-700 active:translate-y-1 transition-all"
              >
                <span className="material-symbols-outlined">download</span>
                엑셀 데이터 다운로드 (.csv)
              </button>
            </div>
          </div>
        )}

        {/* Lobby and Student Management Tab */}
        {activeTab === "lobby" && (
          <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-2xl border-2 border-slate-200 opinion-card">
              <h2 className="font-headline text-xl font-black text-slate-800 mb-4">
                현재 참여 중인 학생 명단 관리
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {room.students.map((student, idx) => (
                  <div
                    key={`${student.name}-${student.groupId || idx}-${idx}`}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 ${
                      student.active ? "bg-white border-amber-300" : "bg-slate-50 border-slate-100 opacity-40"
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-headline text-white"
                      style={{ backgroundColor: student.avatarColor }}
                    >
                      <span className="material-symbols-outlined text-xl">{student.avatarIcon}</span>
                    </div>
                    <div>
                      <h4 className="font-headline font-bold text-sm text-slate-800">
                        {student.name}
                      </h4>
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full block mt-0.5">
                        {student.groupId}모둠
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Simulation test box */}
              <div className="mt-8 p-6 bg-amber-50/50 rounded-2xl border-2 border-dashed border-amber-200/60 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-3 text-amber-800">
                  <span className="material-symbols-outlined text-[20px]">science</span>
                  <h3 className="font-headline text-md font-bold">
                    교사용 토의 시뮬레이션 및 테스트 도구
                  </h3>
                </div>
                <p className="font-sans text-xs text-slate-600 mb-4 leading-relaxed">
                  여러 대의 학생 단말기를 직접 켜고 조작할 필요 없이, 가상 학생들의 로그인과 생각카드(포스트잇) 제출 상태를 클릭 한 번으로 테스트해볼 수 있습니다.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/rooms/${room.roomId}/simulate-join-all`, { method: "POST" });
                        if (res.ok) alert("모든 가상 학생이 대기실에 무사히 입장했습니다! (실시간 동기화 완료)");
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex-1 chunky-button bg-primary-brand text-white font-headline text-xs py-3 rounded-xl border-b-2 border-amber-800 flex items-center justify-center gap-1.5 hover:bg-amber-600 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">group_add</span>
                    전체 가상 학생 로그인 처리
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/rooms/${room.roomId}/simulate-activity`, { method: "POST" });
                        if (res.ok) alert("전체 학생의 가상 모둠 의견 카드가 생성되었습니다! 대시보드나 모둠 판에서 확인해 보세요.");
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="flex-1 chunky-button bg-secondary-brand text-white font-headline text-xs py-3 rounded-xl border-b-2 border-slate-950 flex items-center justify-center gap-1.5 hover:bg-slate-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    가상 의견 카드 자동 등록
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
