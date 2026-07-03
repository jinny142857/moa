export interface Student {
  name: string;
  avatarColor: string;
  joinedAt: number;
  groupId: number; // 1 to 6, or 0 if not assigned yet
  active: boolean;
  avatarIcon: string;
}

export interface PostIt {
  id: string;
  studentName: string;
  text: string;
  originalText?: string;
  color: string;
  likes: number;
  sttCorrected: boolean;
  createdAt: number;
  questionId?: number; // Associated question index (0-indexed)
}

export interface VoteOption {
  id: string;
  text: string;
  count: number;
}

export interface VoteSession {
  question: string;
  options: VoteOption[];
  active: boolean;
  votedStudents: string[]; // List of student names who voted
}

export interface Group {
  id: number; // 1 to 6
  name: string; // "1모둠", "2모둠", etc.
  phase: string; // "1단계: 생각 시간" | "2단계: 발표자 뽑기" | "3단계: 생각 모으기" | "4단계: 투표"
  currentSpeaker: string | null;
  drawnSpeakers: string[]; // students who have spoken
  passTickets: number; // 1 or 2
  postits: PostIt[];
  activeVote: VoteSession | null;
  activityStatus: string; // "Active" | "No activity (3 mins)"
  activityLevel: "high" | "medium" | "low";
  alertMessage: string | null; // e.g. custom message from teacher
  alertType: "encourage" | "warning" | null;
  artifactText?: string; // Group final summary artifact
}

export interface RoomState {
  roomId: string; // 6-digit uppercase code (e.g. "ABCD12" or "MOA777")
  topic: string; // Discussion topic
  character: "moa" | "puri" | "mori"; // mascot character code
  characterName: string; // "모아" | "푸리" | "모리"
  isQuietMode: boolean; // teacher-triggered lock
  currentStepIndex: number; // 0: Lobby, 1: Brainstorming/Board, 2: Spinner/Discussion, 3: Vote, 4: Done
  timerDuration: number; // total duration of current step in seconds
  timerLeft: number; // seconds left
  timerActive: boolean;
  students: Student[];
  groups: Group[];
  lastUpdate: number;
  stepPrompts?: string[]; // Teacher customized step-by-step prompts
  hasArtifact?: boolean; // Enable group collaborative artifact
  groupCount?: number; // Teacher customized number of groups (2 to 6)
  questions?: string[]; // List of custom discussion questions
  hasVote?: boolean; // Toggle voting stage option
  questionsUseRandom?: boolean[]; // Toggle random pick option per question
}
