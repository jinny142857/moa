import React, { useState } from "react";
import { RoomState, Student } from "../types";
import MascotIcon from "./MascotIcon";

interface StudentJoinProps {
  onJoin: (roomId: string, name: string, avatarColor: string, avatarIcon: string) => Promise<boolean>;
  error?: string;
  onBack?: () => void;
}

export default function StudentJoin({ onJoin, error: externalError, onBack }: StudentJoinProps) {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("face_6");
  const [selectedColor, setSelectedColor] = useState("#ffd93d");
  const [step, setStep] = useState<1 | 2>(1); // 1: Enter Room Code, 2: Choose Name & Avatar
  const [roomData, setRoomData] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Avatar choices
  const avatars = [
    "face_6",
    "face_4",
    "sentiment_satisfied",
    "emoji_emotions",
    "face_2",
    "face_3",
    "child_care",
    "pets",
  ];

  // Bright cheerful colors
  const colors = [
    "#ffd93d", // Yellow
    "#6db6fe", // Blue
    "#a8ecad", // Green
    "#ffdad6", // Coral
    "#ffd0e4", // Pink
    "#d0e4ff", // Ice Blue
  ];

  // Step 1: Check room code by fetching room state
  const handleCheckRoom = async () => {
    if (roomId.trim().length !== 6) {
      setError("6자리 입장 코드를 정확히 입력해 주세요!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/rooms/${roomId.toUpperCase()}`);
      if (!response.ok) {
        throw new Error("올바르지 않은 입장 코드입니다.");
      }
      const data: RoomState = await response.json();
      setRoomData(data);
      setStep(2);
    } catch (err: any) {
      setError(err.message || "방 정보를 불러올 수 없습니다. 코드를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Join room
  const handleJoin = async () => {
    if (!name.trim()) {
      setError("이름을 선택하거나 입력해 주세요!");
      return;
    }
    setLoading(true);
    setError("");
    const success = await onJoin(roomId, name, selectedColor, selectedAvatar);
    if (!success) {
      setError("입장에 실패했습니다. 코드를 다시 한 번 확인해 주세요.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 flex flex-col justify-center min-h-[80vh]">
      <header className="mb-8 text-center">
        <div className="inline-block p-3 bg-white/60 backdrop-blur-md rounded-full shadow-sm border border-white/40 mb-3">
          <MascotIcon character={roomData?.character || "moa"} size="lg" className="mx-auto mascot-float" />
        </div>
        <h1 className="font-headline text-3xl font-black text-primary-brand tracking-tight">
          모두모아 (MOA)
        </h1>
        <p className="font-sans text-slate-600 mt-2 text-sm bg-white/40 backdrop-blur-md py-1 px-3 rounded-full border border-white/40 shadow-sm inline-block">
          더 많은 의견을, 모두 다 함께! 🐾
        </p>
      </header>

      <div className="glass-panel p-6 space-y-6">
        {(error || externalError) && (
          <div className="bg-error-container/60 border border-error-brand/20 text-error-brand px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 backdrop-blur-md">
            <span className="material-symbols-outlined">warning</span>
            <span>{error || externalError}</span>
          </div>
        )}

        {step === 1 ? (
          /* Step 1: Enter Room Code */
          <div className="space-y-4">
            <div className="bg-primary-container/40 rounded-xl p-4 border border-primary-brand/10">
              <p className="font-sans text-slate-700 font-medium text-center leading-relaxed text-sm">
                "칠판에 적힌 6자리 방 입장 코드를 아래 칸에 적어줘!"
              </p>
            </div>

            <div className="space-y-2">
              <label className="block font-headline font-bold text-slate-600 text-sm">6자리 코드 입력</label>
              <input
                type="text"
                maxLength={6}
                autoFocus
                className="w-full bg-white/50 border-2 border-primary-container rounded-2xl py-4 text-center font-headline text-3xl font-black text-primary-brand tracking-widest focus:bg-white focus:border-primary-brand outline-none transition-all shadow-inner"
                placeholder="ABCDEF"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex gap-2 pt-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="w-1/3 border-2 border-slate-200/60 text-slate-500 font-headline font-bold py-4 rounded-xl hover:bg-slate-50/50 backdrop-blur-md transition-all text-sm"
                >
                  처음으로
                </button>
              )}
              <button
                onClick={handleCheckRoom}
                disabled={loading}
                className="flex-1 chunky-button bg-primary-brand text-white font-headline text-lg font-bold py-4 rounded-xl border-b-4 border-amber-800 hover:bg-amber-600 active:translate-y-1 transition-all"
              >
                {loading ? "방 확인 중..." : "확인하기 ➡️"}
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Choose Name & Avatar */
          <div className="space-y-5">
            <div className="bg-primary-container/40 rounded-xl p-4 border border-primary-brand/10">
              <p className="font-sans text-slate-700 font-medium text-center leading-relaxed text-sm">
                "안녕! 아래 목록에서 네 이름을 누르거나 아래 직접 써서 로그인해줘!"
              </p>
            </div>

            {/* Quick Name Picker for inactive students */}
            {roomData && roomData.students.length > 0 && (
              <div className="space-y-2">
                <label className="block font-headline font-bold text-slate-600 text-xs">
                  이름 고르기
                </label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto bg-white/30 p-2.5 rounded-xl border border-white/40">
                  {roomData.students
                    .filter((s) => !s.active)
                    .map((s, idx) => (
                      <button
                        key={`${s.name}-${idx}`}
                        onClick={() => setName(s.name)}
                        className={`px-3 py-1.5 rounded-lg font-headline text-sm font-bold border-2 transition-all ${
                          name === s.name
                            ? "bg-primary-brand border-primary-brand text-white scale-105 shadow-sm"
                            : "bg-white/60 border-slate-200/60 text-slate-700 hover:border-amber-200"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Direct Input */}
            <div className="space-y-2">
              <label className="block font-headline font-bold text-slate-600 text-xs">직접 입력</label>
              <input
                type="text"
                className="w-full bg-white/50 border-2 border-slate-200/60 rounded-xl px-4 py-3 font-sans text-sm focus:bg-white focus:border-amber-400 outline-none transition-all shadow-inner"
                placeholder="이름을 직접 적어주세요."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Avatar & Color Picker */}
            <div className="space-y-3">
              <label className="block font-headline font-bold text-slate-600 text-xs">
                캐릭터와 색깔 꾸미기
              </label>

              {/* Icon Selector */}
              <div className="flex justify-between bg-white/30 p-2.5 rounded-xl border border-white/40">
                {avatars.map((av) => (
                  <button
                    key={av}
                    onClick={() => setSelectedAvatar(av)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      selectedAvatar === av
                        ? "bg-secondary-brand text-white scale-110 shadow-md"
                        : "text-slate-500 hover:bg-white/40"
                    }`}
                  >
                    <span className="material-symbols-outlined">{av}</span>
                  </button>
                ))}
              </div>

              {/* Color Palette */}
              <div className="flex justify-between bg-white/30 p-2.5 rounded-xl border border-white/40">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      selectedColor === color ? "border-slate-800 scale-125 shadow-sm" : "border-white"
                    }`}
                    style={{ backgroundColor: color }}
                  ></button>
                ))}
              </div>
            </div>

            {/* Join Action button */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 border-2 border-slate-200/60 text-slate-500 font-headline font-bold py-4 rounded-xl hover:bg-slate-50/50 backdrop-blur-md transition-all text-sm"
              >
                뒤로
              </button>
              <button
                onClick={handleJoin}
                disabled={loading}
                className="flex-1 chunky-button bg-primary-brand text-white font-headline text-lg font-bold py-4 rounded-xl border-b-4 border-amber-800 hover:bg-amber-600 active:translate-y-1 transition-all"
              >
                {loading ? "입장하는 중..." : "토의방 참여하기 ➡️"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
