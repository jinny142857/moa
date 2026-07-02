import React, { useState, useEffect } from "react";
import { RoomState, Student, Group } from "../types";
import MascotIcon from "./MascotIcon";

interface TeacherLobbyProps {
  room: RoomState | null;
  onCreateRoom: (
    topic: string, 
    character: string, 
    studentNames: string[],
    stepPrompts?: string[],
    hasArtifact?: boolean,
    groupCount?: number,
    questions?: string[],
    hasVote?: boolean
  ) => void;
  onStartLesson: () => void;
  teacherUser?: { name: string; email: string; picture?: string } | null;
  onBack?: () => void;
}

interface SavedPreset {
  id: string;
  name: string;
  topic: string;
  stepPrompts: string[];
  hasArtifact: boolean;
  groupCount: number;
  studentInput: string;
  questions?: string[];
  hasVote?: boolean;
}

export default function TeacherLobby({ 
  room, 
  onCreateRoom, 
  onStartLesson, 
  teacherUser,
  onBack 
}: TeacherLobbyProps) {
  const [topic, setTopic] = useState("우리가 실천할 수 있는 환경 보호 방법은 무엇일까요?");
  const [character, setCharacter] = useState<"moa" | "puri" | "mori">("moa");
  const [studentInput, setStudentInput] = useState(
    "민준, 서연, 도윤, 하은, 주원, 지우, 예준, 수아, 준우, 서아, 지호, 민지, 선우, 유진, 도현, 채원, 시우, 서현, 지훈, 하윤, 지호2, 민수"
  );
  const [loading, setLoading] = useState(false);

  // Admin Mode & Customizable settings
  const [isAdminMode, setIsAdminMode] = useState(true);
  const [questions, setQuestions] = useState<string[]>([
    "우리가 일상에서 무심히 버리는 쓰레기에는 어떤 것들이 있을까요?",
    "그 쓰레기들을 줄이기 위해 학교에서 당장 실천할 수 있는 방법은 무엇일까요?"
  ]);
  const [hasVote, setHasVote] = useState(true);
  const [hasArtifact, setHasArtifact] = useState(false);
  const [groupCount, setGroupCount] = useState<number>(6);

  // Preset management
  const [presets, setPresets] = useState<SavedPreset[]>([]);
  const [presetNameInput, setPresetNameInput] = useState("");

  useEffect(() => {
    const fetchPresets = async () => {
      if (teacherUser?.email) {
        try {
          const res = await fetch(`/api/presets?email=${encodeURIComponent(teacherUser.email)}`);
          if (res.ok) {
            const data = await res.json();
            // Map table snake_case keys back to camelCase
            const mapped = data.map((p: any) => ({
              id: p.id,
              name: p.name,
              topic: p.topic,
              questions: p.questions,
              hasVote: p.has_vote !== undefined ? p.has_vote : true,
              hasArtifact: p.has_artifact !== undefined ? p.has_artifact : false,
              groupCount: p.group_count || 6,
              studentInput: p.student_input || "",
            }));
            if (mapped.length > 0) {
              setPresets(mapped);
              return;
            }
          }
        } catch (e) {
          console.error("Failed to load presets from database, falling back to local storage:", e);
        }
      }

      // Load presets from localStorage as fallback
      const saved = localStorage.getItem("moa_presets");
      if (saved) {
        try {
          setPresets(JSON.parse(saved));
        } catch (e) {}
      } else {
        // Default initial preset
        const defaultPreset: SavedPreset = {
          id: "default-env",
          name: "🌱 환경 보호 실천 토의 기본 세트",
          topic: "우리가 실천할 수 있는 환경 보호 방법은 무엇일까요?",
          stepPrompts: [],
          hasArtifact: true,
          groupCount: 6,
          studentInput: "민준, 서연, 도윤, 하은, 주원, 지우, 예준, 수아, 준우, 서아, 지호, 민지, 선우, 유진, 도현, 채원, 시우, 서현, 지훈, 하윤, 지호2, 민수",
          questions: [
            "우리가 일상에서 무심히 버리는 쓰레기에는 어떤 것들이 있을까요?",
            "그 쓰레기들을 줄이기 위해 학교에서 당장 실천할 수 있는 방법은 무엇일까요?"
          ],
          hasVote: true
        };
        setPresets([defaultPreset]);
        localStorage.setItem("moa_presets", JSON.stringify([defaultPreset]));
      }
    };

    fetchPresets();
  }, [teacherUser]);

  const handleSavePreset = async () => {
    if (!presetNameInput.trim()) {
      alert("저장할 프리셋 이름을 입력해주세요!");
      return;
    }
    const newPreset: SavedPreset = {
      id: Date.now().toString(),
      name: presetNameInput.trim(),
      topic,
      stepPrompts: [],
      hasArtifact,
      groupCount,
      studentInput,
      questions,
      hasVote,
    };

    if (teacherUser?.email) {
      try {
        const res = await fetch("/api/presets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: teacherUser.email,
            name: newPreset.name,
            topic: newPreset.topic,
            questions: newPreset.questions,
            hasVote: newPreset.hasVote,
            hasArtifact: newPreset.hasArtifact,
            groupCount: newPreset.groupCount,
            studentInput: newPreset.studentInput
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const savedDbPreset: SavedPreset = {
              id: data.preset.id,
              name: data.preset.name,
              topic: data.preset.topic,
              questions: data.preset.questions,
              hasVote: data.preset.has_vote,
              hasArtifact: data.preset.has_artifact,
              groupCount: data.preset.group_count,
              studentInput: data.preset.student_input
            };
            setPresets([savedDbPreset, ...presets]);
            setPresetNameInput("");
            alert("프리셋이 Supabase 데이터베이스에 영구히 저장되었습니다!");
            return;
          } else {
            alert(`데이터베이스 저장 실패: ${data.error}`);
            return;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          alert(`서버 에러 (${res.status}): ${errData.error || "프리셋 저장 실패"}`);
          return;
        }
      } catch (err: any) {
        console.error("Failed to save preset to database:", err);
        alert(`네트워크 통신 오류: ${err.message || String(err)}`);
        return;
      }
    }

    // Fallback save to localStorage
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem("moa_presets", JSON.stringify(updated));
    setPresetNameInput("");
    alert("로그인 정보가 없어 프리셋을 브라우저 로컬 저장소에 저장했습니다!");
  };

  const handleLoadPreset = (preset: SavedPreset) => {
    setTopic(preset.topic);
    if (preset.questions) {
      setQuestions(preset.questions);
    } else {
      setQuestions([preset.topic]);
    }
    if (preset.hasVote !== undefined) {
      setHasVote(preset.hasVote);
    }
    setHasArtifact(preset.hasArtifact);
    setGroupCount(preset.groupCount);
    setStudentInput(preset.studentInput);
    alert(`"${preset.name}" 프리셋을 불러왔습니다!`);
  };

  const handleDeletePreset = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("정말 이 프리셋을 삭제하시겠습니까?")) {
      if (teacherUser?.email && id !== "default-env") {
        try {
          const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
          if (res.ok) {
            setPresets(presets.filter(p => p.id !== id));
            alert("프리셋이 데이터베이스에서 완전히 삭제되었습니다.");
            return;
          }
        } catch (err) {
          console.error("Failed to delete preset from database:", err);
        }
      }

      const updated = presets.filter(p => p.id !== id);
      setPresets(updated);
      localStorage.setItem("moa_presets", JSON.stringify(updated));
    }
  };

  const handleCreate = () => {
    if (!topic.trim()) {
      alert("토의 주제를 입력해주세요!");
      return;
    }
    const filteredQuestions = questions.filter((q) => q.trim().length > 0);
    if (filteredQuestions.length === 0) {
      alert("최소 한 개 이상의 토의 질문(발문)을 입력해주세요!");
      return;
    }
    setLoading(true);
    // Parse comma or newline separated student names
    const names = studentInput
      .split(/[\n,]+/)
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
      
    onCreateRoom(
      topic, 
      character, 
      names, 
      undefined, 
      isAdminMode ? hasArtifact : false, 
      isAdminMode ? groupCount : 6,
      filteredQuestions,
      hasVote
    );
    setLoading(false);
  };

  // If no room is active yet, show Room Builder Config page
  if (!room) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 md:p-8 animate-fade-in">
        <header className="mb-8 text-center relative">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-0 top-0 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all flex items-center gap-1 font-bold text-sm"
              title="처음 화면으로"
            >
              <span className="material-symbols-outlined">arrow_back</span>
              <span className="hidden sm:inline">처음으로</span>
            </button>
          )}
          <div className="flex justify-center mb-4">
            <MascotIcon character={character} size="lg" className="mascot-float" />
          </div>
          <h1 className="font-headline text-3xl md:text-4xl text-primary-brand font-black tracking-tight">
            모두 모아 (MOA) 토의 수업 빌더
          </h1>
          <p className="font-sans text-lg text-slate-600 mt-2">
            더 많은 의견을, 모두 다 함께! 기기 간 화면 동기화 퍼실리테이터
          </p>

          {teacherUser && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-bold text-amber-800 shadow-sm">
              <span className="material-symbols-outlined text-sm text-amber-600">verified_user</span>
              <span>인증 교사: {teacherUser.name} ({teacherUser.email})</span>
            </div>
          )}
        </header>

        <div className="space-y-6">
          {/* Preset Management Panel */}
          <div className="glass-panel p-6 bg-amber-50/30 border border-amber-200/50 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-headline text-lg font-bold text-secondary-brand flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">bookmarks</span>
                💾 교사용 수업 설계 프리셋 불러오기
              </h3>
              <span className="text-xs text-slate-400">기존 설정을 불러옵니다.</span>
            </div>

            {/* Presets List */}
            {presets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {presets.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleLoadPreset(p)}
                    className="flex justify-between items-center p-3.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-400 rounded-xl cursor-pointer transition-all shadow-sm group animate-fade-in"
                  >
                    <div className="text-left space-y-1">
                      <p className="font-sans font-bold text-sm text-slate-800 group-hover:text-primary-brand">
                        {p.name}
                      </p>
                      <p className="font-sans text-xs text-slate-400 truncate max-w-[250px]">
                        주제: {p.topic}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeletePreset(p.id, e)}
                      className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="프리셋 삭제"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-sans text-sm text-slate-400 text-center py-2">등록된 수업 설계 프리셋이 없습니다.</p>
            )}
          </div>

          <div className="glass-panel p-6 md:p-8 space-y-6">
            {/* Topic Selection */}
            <div className="space-y-2">
              <label className="block font-headline text-lg font-bold text-secondary-brand">
                📢 오늘 토의 대주제 등록
              </label>
              <input
                type="text"
                className="w-full bg-white/50 border-2 border-slate-200/60 rounded-xl px-4 py-3 font-sans text-lg focus:bg-white focus:border-amber-400 outline-none transition-all shadow-inner"
                placeholder="토의 대주제를 적어주세요. (예: 우리가 실천할 수 있는 환경 보호 방법)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            {/* Dynamic Questions (발문) Manager */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <label className="block font-headline text-lg font-bold text-secondary-brand">
                  ✍️ 토의 세부 질문(발문) 등록 및 편집
                </label>
                <button
                  type="button"
                  onClick={() => setQuestions([...questions, ""])}
                  className="bg-primary-brand text-white font-headline text-xs font-bold px-3 py-1.5 rounded-lg border-b-2 border-amber-800 hover:bg-amber-600 active:translate-y-0.5 transition-all flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  질문 추가
                </button>
              </div>
              
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={idx} className="flex gap-2 items-center animate-fade-in">
                    <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-headline font-bold text-slate-500 shrink-0 text-sm">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx] = e.target.value;
                        setQuestions(updated);
                      }}
                      placeholder={`발문 ${idx + 1}을 입력해주세요.`}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm outline-none focus:border-amber-400 transition-colors"
                    />
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = questions.filter((_, i) => i !== idx);
                          setQuestions(updated);
                        }}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                        title="삭제"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                💡 질문 개수에 따라 토의 화면 단계([생각 정리] ➡️ [발표] ➡️ [의견 모으기])가 질문별로 순환 배치되며, 사회자(마스코트)의 안내 멘트도 자동으로 생성됩니다.
              </p>
            </div>

            {/* Character selection */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block font-headline text-lg font-bold text-secondary-brand">
                🦊 디지털 퍼실리테이터(사회자) 캐릭터 선택
              </label>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    character === "moa"
                      ? "border-primary-brand bg-primary-container/40 shadow-md scale-105"
                      : "border-slate-200/60 hover:border-amber-200"
                  }`}
                  onClick={() => setCharacter("moa")}
                >
                  <MascotIcon character="moa" size="md" className="mb-2" />
                  <span className="font-headline font-bold text-on-primary-container text-xs sm:text-sm">모아 (친근한 아기 고양이)</span>
                </button>

                <button
                  type="button"
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    character === "puri"
                      ? "border-tertiary-brand bg-tertiary-container/40 shadow-md scale-105"
                      : "border-slate-200/60 hover:border-green-200"
                  }`}
                  onClick={() => setCharacter("puri")}
                >
                  <MascotIcon character="puri" size="md" className="mb-2" />
                  <span className="font-headline font-bold text-tertiary-brand text-xs sm:text-sm">푸리 (초록 생각 나무)</span>
                </button>

                <button
                  type="button"
                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    character === "mori"
                      ? "border-sky-500 bg-sky-50/50 shadow-md scale-105"
                      : "border-slate-200/60 hover:border-sky-200"
                  }`}
                  onClick={() => setCharacter("mori")}
                >
                  <MascotIcon character="mori" size="md" className="mb-2" />
                  <span className="font-headline font-bold text-sky-800 text-xs sm:text-sm">모리 (파란 생각 다람쥐)</span>
                </button>
              </div>
            </div>

            {/* Student roster upload */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block font-headline text-lg font-bold text-secondary-brand">
                  👥 학생 명단 등록 (줄바꿈 또는 쉼표 구분)
                </label>
                <span className="text-xs bg-white/60 text-slate-500 px-2 py-1 rounded-md border border-white/40 shadow-sm">
                  엑셀에서 복사해 붙여넣기 가능
                </span>
              </div>
              <textarea
                className="w-full bg-white/50 border-2 border-slate-200/60 rounded-xl px-4 py-3 font-sans text-md focus:bg-white focus:border-amber-400 outline-none transition-all h-32 shadow-inner"
                value={studentInput}
                onChange={(e) => setStudentInput(e.target.value)}
                placeholder="예: 김민수, 이서아, 박지호, 정민지"
              />
            </div>

            {/* Admin Mode - Customizable Options Drawer */}
            <div className="pt-4 border-t border-slate-200/80 space-y-4">
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="text-left">
                  <h4 className="font-headline text-md font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-500">settings_applications</span>
                    교사 관리자 상세 옵션 모드
                  </h4>
                  <p className="text-xs text-slate-500">산출물 유무, 투표 단계 활성화, 모둠 수 정밀 설정</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdminMode(!isAdminMode)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAdminMode ? "bg-amber-500" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isAdminMode ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {isAdminMode && (
                <div className="space-y-4 p-4 bg-slate-50/40 rounded-2xl border border-slate-200/60 text-left animate-fade-in">
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Has Vote (투표 여부) */}
                    <div className="space-y-2">
                      <span className="block text-xs font-bold text-slate-500">🗳️ 실천가능성 미니 투표 단계 포함</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setHasVote(true)}
                          className={`flex-1 font-headline font-bold text-xs py-2.5 rounded-xl border transition-all ${
                            hasVote
                              ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          투표 진행함
                        </button>
                        <button
                          type="button"
                          onClick={() => setHasVote(false)}
                          className={`flex-1 font-headline font-bold text-xs py-2.5 rounded-xl border transition-all ${
                            !hasVote
                              ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          투표 건너뜀
                        </button>
                      </div>
                    </div>

                    {/* Has Artifact (산출물 유무) */}
                    <div className="space-y-2">
                      <span className="block text-xs font-bold text-slate-500">📝 모둠 최종 산출물(결론 정리) 생성</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setHasArtifact(true)}
                          className={`flex-1 font-headline font-bold text-xs py-2.5 rounded-xl border transition-all ${
                            hasArtifact
                              ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          산출물 있음 (직접 타이핑)
                        </button>
                        <button
                          type="button"
                          onClick={() => setHasArtifact(false)}
                          className={`flex-1 font-headline font-bold text-xs py-2.5 rounded-xl border transition-all ${
                            !hasArtifact
                              ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          산출물 없음
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Group Count Selection (모둠 수) */}
                  <div className="space-y-2 pt-2 border-t border-slate-200/40">
                    <span className="block text-xs font-bold text-slate-500">📊 학급 총 모둠 수 설정</span>
                    <div className="flex gap-1.5 bg-white p-1 border border-slate-200 rounded-xl max-w-md">
                      {[2, 3, 4, 5, 6].map((num) => (
                        <button
                          type="button"
                          key={num}
                          onClick={() => setGroupCount(num)}
                          className={`flex-1 font-headline font-bold text-xs py-1.5 rounded-lg transition-all ${
                            groupCount === num
                              ? "bg-slate-800 text-white"
                              : "text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {num}모둠
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            <div className="pt-4 space-y-4">
              <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-200/50 space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <h4 className="font-headline text-sm font-bold text-secondary-brand flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-600">save</span>
                    💾 현재 설정을 새 프리셋으로 저장해두기
                  </h4>
                  <span className="text-[10px] text-slate-400">다음에 다시 쓸 수 있어요!</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="저장할 프리셋 이름을 지어주세요... (예: 2학기 환경 보호 토의)"
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2 font-sans text-xs outline-none focus:border-amber-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSavePreset}
                    className="bg-secondary-brand text-white font-headline text-xs font-bold px-4 py-2 rounded-xl border-b-2 border-slate-700 hover:bg-slate-700 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    현재 설정 저장
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={loading}
                className="w-full chunky-button bg-primary-brand text-white font-headline text-xl font-bold py-4 rounded-xl border-b-4 border-amber-800 hover:bg-amber-600 active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">add_circle</span>
                {loading ? "생성 중..." : "새로운 토의 방 생성하기 ➡️"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Lobby screen
  const joinedStudents = room.students.filter((s) => s.active);
  const totalStudents = room.students.length;

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
      <header className="mb-8 text-center relative">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-0 top-0 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all flex items-center gap-1 font-bold text-sm"
            title="처음 화면으로"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="hidden sm:inline">처음으로</span>
          </button>
        )}
        <MascotIcon character={room.character} size="lg" className="mx-auto mb-4 mascot-float" />
        <h1 className="font-headline text-3xl md:text-4xl text-primary-brand font-black tracking-tight">
          토의 대기실 로비 ({room.roomId})
        </h1>
        <p className="font-sans text-md text-slate-500">
          학생들이 화면에 입장할 때까지 잠시 기다려 주세요!
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Entry Room Code & Start */}
        <div className="lg:col-span-7 space-y-6">
          <section className="glass-panel p-6 bg-white/40 border border-white/50 text-center">
            <h2 className="font-headline text-lg font-bold text-secondary-brand mb-2">
              학생 입장용 6자리 코드
            </h2>
            <div className="bg-white/40 border-2 border-dashed border-primary-brand/30 rounded-xl py-6 font-headline text-5xl font-black text-primary-brand tracking-widest flex items-center justify-center gap-2">
              {room.roomId.split("").map((char, index) => (
                <span
                  key={index}
                  className="bg-white px-3 py-1 rounded-lg border-2 border-white/60 shadow-sm inline-block"
                >
                  {char}
                </span>
              ))}
            </div>
            <p className="font-sans text-xs text-slate-500 mt-3">
              학생 기기에서 인터넷 브라우저로 접속한 뒤 위 코드를 입력하면 참여할 수 있습니다.
            </p>
          </section>

          {/* Social Guide Speech Bubble */}
          <div className="relative flex items-start gap-4 glass-panel p-6 bg-white/40 border border-white/50 shadow-md text-left">
            <div className="hidden sm:block">
              <MascotIcon character={room.character} size="md" />
            </div>
            <div className="flex-1">
              <p className="font-headline text-lg font-black text-secondary-brand mb-1">
                {room.characterName} 사회자의 멘트:
              </p>
              <div className="bg-primary-container/40 p-3 rounded-lg border border-primary-brand/10">
                <p className="font-sans text-md text-slate-700 leading-snug">
                  {joinedStudents.length === 0
                    ? '"친구들아 얼른 들어와! 신나는 토론을 준비하고 있어!" 🐾'
                    : joinedStudents.length === totalStudents
                    ? '"와! 우리 모둠 친구들이 모두 모였어! 🎉 어서 토의를 시작하자!"'
                    : `"${joinedStudents[joinedStudents.length - 1]?.name}(이)가 무사히 입장했구나! 아직 안 온 친구들도 기다리는 중이야~" ⏳`}
                </p>
              </div>
            </div>
          </div>

          {/* Simulation test box in Lobby */}
          <div className="bg-amber-50/50 p-6 rounded-2xl border-2 border-dashed border-amber-200/60 backdrop-blur-md text-left">
            <div className="flex items-center gap-2 mb-2 text-amber-800">
              <span className="material-symbols-outlined text-[20px]">science</span>
              <h3 className="font-headline text-md font-bold">
                교사용 학생 입장 테스트 도구 (시뮬레이터)
              </h3>
            </div>
            <p className="font-sans text-xs text-slate-600 mb-3 leading-relaxed">
              여러 기기에서 직접 로그인하지 않아도, 원클릭으로 모든 등록 학생을 한 번에 입장시켜 실시간 연결 및 작동 여부를 테스트해볼 수 있습니다.
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/rooms/${room.roomId}/simulate-join-all`, { method: "POST" });
                  if (res.ok) {
                    // Handled by SSE, state updates automatically!
                  }
                } catch (err) {
                  console.error(err);
                }
              }}
              className="w-full chunky-button bg-primary-brand text-white font-headline text-sm py-3 rounded-xl border-b-2 border-amber-800 flex items-center justify-center gap-1.5 hover:bg-amber-600 transition-all"
            >
              <span className="material-symbols-outlined text-sm">group_add</span>
              가상 학생들 전부 로그인 시키기
            </button>
          </div>

          {/* Start Button */}
          <button
            onClick={onStartLesson}
            className="w-full chunky-button bg-primary-brand text-white font-headline text-xl font-bold py-5 rounded-2xl border-b-4 border-amber-800 hover:bg-amber-600 active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-3xl">play_circle</span>
            토의 수업 정식 시작하기 ➡️
          </button>
        </div>

        {/* Right column: Roster of joined/waiting students */}
        <div className="lg:col-span-5 space-y-6">
          <section className="glass-panel p-6 bg-white/40 border border-white/50 shadow-inner">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-headline text-lg font-bold text-secondary-brand">
                대기실 참여 인원 ({joinedStudents.length} / {totalStudents})
              </h3>
              <span className="inline-flex h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {room.students.map((student, idx) => (
                <div
                  key={`${student.name}-${student.groupId || idx}-${idx}`}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all ${
                    student.active
                      ? "bg-white border-primary-brand/30 shadow-sm animate-scale-in"
                      : "bg-white/10 border-slate-200/40 opacity-40"
                  }`}
                >
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-full border-4 border-white shadow-md flex items-center justify-center font-headline text-white"
                      style={{ backgroundColor: student.avatarColor }}
                    >
                      <span className="material-symbols-outlined text-3xl">
                        {student.avatarIcon}
                      </span>
                    </div>
                    {student.active && (
                      <div className="absolute -bottom-1 -right-1 bg-green-500 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                        <span className="material-symbols-outlined text-[12px] text-white font-bold">
                          check
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="font-headline font-bold text-sm mt-2 text-slate-800">
                    {student.name}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full mt-1">
                    {student.groupId}모둠
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
