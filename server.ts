import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { RoomState, Group, Student, PostIt } from "./src/types";

dotenv.config();

const app = express();
const PORT = 3000;
const ROOMS_FILE = path.join(process.cwd(), "rooms.json");

app.use(express.json());

// Vercel 환경에서 프론트엔드가 요청한 원래 URL 경로 복원
app.use((req, res, next) => {
  const forwardedUrl = req.headers["x-forwarded-url"];
  if (forwardedUrl && typeof forwardedUrl === "string") {
    req.url = forwardedUrl;
  }
  next();
});

// 환경변수 양 끝의 따옴표 및 공백을 제거해 주는 공통 유틸리티 함수
function cleanEnvVar(val: string | undefined): string {
  if (!val) return "";
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

// Initialize Supabase Client
const supabaseUrl = cleanEnvVar(process.env.SUPABASE_URL);
// 'SUPABSE_ANON_KEY' 오탈자 대응용 폴백 추가
const supabaseAnonKey = cleanEnvVar(process.env.SUPABASE_ANON_KEY || process.env.SUPABSE_ANON_KEY);

let supabase: any = null;

try {
  if (supabaseUrl && supabaseUrl.startsWith("http") && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (err) {
  console.error("⚠️ Failed to initialize Supabase client:", err);
}

if (supabase) {
  console.log("✅ Supabase client initialized successfully.");
} else {
  console.warn("⚠️ Supabase not configured or invalid URL. Using local file storage only.");
}

// Initialize Gemini SDK lazily
let ai: any = null;
function getGeminiClient() {
  const rawApiKey = process.env.GEMINI_API_KEY || process.env.gemini_api;
  if (!ai && rawApiKey) {
    try {
      const apiKey = cleanEnvVar(rawApiKey);
      ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      console.log("Gemini API Client initialized successfully.");
    } catch (e) {
      console.error("Failed to initialize Gemini API client:", e);
    }
  }
  return ai;
}

// In-memory Room Storage (메모리 + 파일 + Supabase 동기화)
let rooms: Record<string, RoomState> = {};

// Load saved rooms on start if exists
if (fs.existsSync(ROOMS_FILE)) {
  try {
    const data = fs.readFileSync(ROOMS_FILE, "utf-8");
    rooms = JSON.parse(data);
    console.log(`Loaded ${Object.keys(rooms).length} active rooms from rooms.json`);
  } catch (e) {
    console.error("Failed to parse rooms.json:", e);
    rooms = {};
  }
}

// Save rooms to both file and Supabase
async function saveRooms() {
  try {
    // 파일에 저장
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
    
    // Supabase에도 저장 (비동기)
    if (supabase) {
      for (const [roomId, room] of Object.entries(rooms)) {
        try {
          await supabase
            .from("rooms")
            .upsert({ room_id: roomId, room_state: room })
            .select();
        } catch (err) {
          console.error(`Failed to save room ${roomId} to Supabase:`, err);
        }
      }
    }
  } catch (e) {
    console.error("Failed to save rooms:", e);
  }
}

// Event Stream Listeners
let sseClients: Record<string, express.Response[]> = {};

function addSseClient(roomId: string, res: express.Response) {
  if (!sseClients[roomId]) {
    sseClients[roomId] = [];
  }
  sseClients[roomId].push(res);
}

function removeSseClient(roomId: string, res: express.Response) {
  if (sseClients[roomId]) {
    sseClients[roomId] = sseClients[roomId].filter((client) => client !== res);
  }
}

function broadcastRoomUpdate(roomId: string) {
  const room = rooms[roomId];
  if (!room) return;
  
  room.lastUpdate = Date.now();
  
  const clients = sseClients[roomId] || [];
  const payload = `data: ${JSON.stringify(room)}\n\n`;
  
  clients.forEach((res) => {
    try {
      res.write(payload);
    } catch (e) {
      // client connection likely dead
    }
  });
}

// Generate unique 6-digit uppercase code
function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No easily confused characters like I, O, 1, 0
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Guarantee unique code
  if (rooms[code]) {
    return generateRoomId();
  }
  return code;
}

// Background timer routine (runs every second for active rooms)
setInterval(() => {
  let changed = false;
  Object.keys(rooms).forEach((roomId) => {
    const room = rooms[roomId];
    if (room.timerActive && room.timerLeft > 0) {
      room.timerLeft -= 1;
      if (room.timerLeft === 0) {
        room.timerActive = false;
      }
      changed = true;
      broadcastRoomUpdate(roomId);
    }
  });
  if (changed) {
    saveRooms();
  }
}, 1000);

// ================= API ENDPOINTS =================

// Create Room (Teacher Mode)
app.post("/api/rooms/create", (req, res) => {
  const { topic, character, studentNames, stepPrompts, hasArtifact, groupCount, questions, hasVote, questionsUseRandom } = req.body;
  
  if (!topic) {
    res.status(400).json({ error: "토의 주제가 필요합니다." });
    return;
  }
  
  const roomId = generateRoomId();
  const characterName = character === "puri" ? "푸리" : character === "mori" ? "모리" : "모아";
  
  // Set up customizable groups count (default 6)
  const groupCountNum = Number(groupCount) || 6;
  const groups: Group[] = Array.from({ length: groupCountNum }).map((_, i) => ({
    id: i + 1,
    name: `${i + 1}모둠`,
    phase: "1단계: 생각 시간",
    currentSpeaker: null,
    drawnSpeakers: [],
    passTickets: 2,
    postits: [],
    activeVote: null,
    activityStatus: "Active",
    activityLevel: "medium",
    alertMessage: null,
    alertType: null,
    artifactText: "",
  }));
  
  // Prepare registered student roster
  const namesList = Array.isArray(studentNames) ? studentNames.filter(Boolean) : [];
  const students: Student[] = namesList.map((name, i) => {
    // Balance groups round-robin based on dynamic groupCount
    const gId = (i % groupCountNum) + 1;
    return {
      name,
      avatarColor: ["#ffd93d", "#6db6fe", "#a8ecad", "#ffdad6", "#ffd0e4", "#d0e4ff"][i % 6],
      joinedAt: 0,
      groupId: gId,
      active: false,
      avatarIcon: ["face_6", "face_4", "sentiment_satisfied", "emoji_emotions", "face_2", "face_3"][i % 6],
    };
  });
  
  const newRoom: RoomState = {
    roomId,
    topic,
    character: character || "moa",
    characterName,
    isQuietMode: false,
    currentStepIndex: 0, // 0 is Lobby
    timerDuration: 180,
    timerLeft: 180,
    timerActive: false,
    students,
    groups,
    lastUpdate: Date.now(),
    stepPrompts: stepPrompts || [
      "오늘의 핵심 질문에 대해 조용히 생각을 적어보는 시간이야! 떠오른 생각을 아래 칠판에 붙여보자! 💡",
      "모둠 발표자를 정해볼 시간이야! 아래 추천기를 통해 순서를 정해보자. 친구 차례가 오면 마이크에 경청해 줘! 🎤",
      "모둠 친구들이 낸 의견이 칠판에 모두 모였어! 하나씩 정성스레 읽어보고 정말 훌륭한 아이디어에 아낌없이 하트(❤️)를 눌러주자!",
      "자! 실천가능성이 가장 훌륭한 카드 의견에 투표를 해볼 차례야! 모둠 최고의 명예는 누가 얻게 될까?"
    ],
    hasArtifact: hasArtifact !== undefined ? Boolean(hasArtifact) : false,
    groupCount: groupCountNum,
    questions: Array.isArray(questions) ? questions.filter(Boolean) : [topic],
    hasVote: hasVote !== undefined ? Boolean(hasVote) : false,
    questionsUseRandom: Array.isArray(questionsUseRandom) ? questionsUseRandom.map(Boolean) : (Array.isArray(questions) ? questions.map(() => true) : [true]),
  };
  
  rooms[roomId] = newRoom;
  saveRooms();
  
  console.log(`Created room ${roomId} with ${students.length} students and ${groupCountNum} groups`);
  res.json({ roomId, room: newRoom });
});

// --- Preset Debugging/Diagnostic Endpoint ---
app.get("/api/debug-supabase", (req, res) => {
  const rawUrl = process.env.SUPABASE_URL || "";
  const rawKey = process.env.SUPABASE_ANON_KEY || "";
  const rawGoogleId = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || "";
  const rawGoogleSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || "";
  
  // 서버에 실제로 로드된 환경변수 Key 이름들만 필터링하여 노출 (보안을 위해 값은 제외)
  const allEnvKeys = Object.keys(process.env);
  const relevantKeys = allEnvKeys.filter(k => 
    k.toUpperCase().includes("SUPABASE") || 
    k.toUpperCase().includes("GOOGLE") || 
    k.toUpperCase().includes("GEMINI") ||
    k.toUpperCase().includes("CLIENT") ||
    k.toUpperCase().includes("SECRET") ||
    k.toUpperCase().includes("KEY")
  );

  res.json({
    urlConfigured: !!rawUrl,
    keyConfigured: !!rawKey,
    urlLength: rawUrl.length,
    keyLength: rawKey.length,
    urlStart: rawUrl.substring(0, 12),
    cleanedUrlStart: supabaseUrl ? supabaseUrl.substring(0, 12) : "null",
    isClientInitialized: supabase !== null,
    googleIdConfigured: !!rawGoogleId,
    googleIdLength: rawGoogleId.length,
    googleIdStart: rawGoogleId.substring(0, 10),
    googleSecretConfigured: !!rawGoogleSecret,
    googleSecretLength: rawGoogleSecret.length,
    allKeysFoundOnServer: relevantKeys
  });
});

// --- Preset Management APIs (Supabase backend synchronization) ---
app.get("/api/presets", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    res.status(400).json({ error: "이메일이 누락되었습니다." });
    return;
  }
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("presets")
        .select("*")
        .eq("email", email)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      res.json(data || []);
    } catch (err) {
      console.error("Failed to load presets from Supabase:", err);
      res.json([]);
    }
  } else {
    res.json([]);
  }
});

app.post("/api/presets", async (req, res) => {
  const { email, name, topic, questions, hasVote, hasArtifact, groupCount, studentInput } = req.body;
  if (!email || !name) {
    res.status(400).json({ error: "필수 정보가 누락되었습니다." });
    return;
  }
  
  if (supabase) {
    try {
      const newId = Math.random().toString(36).substring(2, 9);
      const { data, error } = await supabase
        .from("presets")
        .insert({
          id: newId,
          email,
          name,
          topic,
          questions,
          has_vote: Boolean(hasVote),
          has_artifact: Boolean(hasArtifact),
          group_count: Number(groupCount) || 6,
          student_input: studentInput,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) throw error;
      res.json({ success: true, preset: data });
    } catch (err) {
      console.error("Failed to save preset to Supabase:", err);
      res.status(500).json({ error: "프리셋 저장 실패" });
    }
  } else {
    res.json({ success: false, error: "Supabase가 연결되어 있지 않습니다." });
  }
});

app.delete("/api/presets/:id", async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      const { error } = await supabase
        .from("presets")
        .delete()
        .eq("id", id);
        
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete preset from Supabase:", err);
      res.status(500).json({ error: "프리셋 삭제 실패" });
    }
  } else {
    res.json({ success: false });
  }
});

// Update Room Configuration (Teacher Mode edit)
app.post("/api/rooms/:roomId/update", (req, res) => {
  const { roomId } = req.params;
  const { topic, character, studentNames, stepPrompts, hasArtifact, groupCount, questions, hasVote } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "존재하지 않는 방 코드입니다." });
    return;
  }
  
  if (topic) room.topic = topic;
  if (character) {
    room.character = character;
    room.characterName = character === "puri" ? "푸리" : character === "mori" ? "모리" : "모아";
  }
  if (stepPrompts) room.stepPrompts = stepPrompts;
  if (hasArtifact !== undefined) room.hasArtifact = Boolean(hasArtifact);
  if (questions) room.questions = Array.isArray(questions) ? questions.filter(Boolean) : [room.topic];
  if (hasVote !== undefined) room.hasVote = Boolean(hasVote);
  
  const oldGroupCount = room.groupCount || 6;
  const newGroupCount = Number(groupCount) || oldGroupCount;
  room.groupCount = newGroupCount;
  
  // Re-adjust groups if count changed
  if (newGroupCount !== oldGroupCount) {
    const groups: Group[] = Array.from({ length: newGroupCount }).map((_, i) => {
      const existing = room.groups.find(g => g.id === i + 1);
      if (existing) {
        return existing;
      }
      return {
        id: i + 1,
        name: `${i + 1}모둠`,
        phase: room.groups[0]?.phase || "1단계: 생각 시간",
        currentSpeaker: null,
        drawnSpeakers: [],
        passTickets: 2,
        postits: [],
        activeVote: null,
        activityStatus: "Active",
        activityLevel: "medium",
        alertMessage: null,
        alertType: null,
        artifactText: "",
      };
    });
    room.groups = groups;
  }
  
  // Update students roster
  if (Array.isArray(studentNames)) {
    const namesList = studentNames.filter(Boolean);
    const updatedStudents: Student[] = namesList.map((name, i) => {
      const existing = room.students.find(s => s.name === name);
      if (existing) {
        if (existing.groupId > newGroupCount) {
          existing.groupId = (i % newGroupCount) + 1;
        }
        return existing;
      }
      
      const gId = (i % newGroupCount) + 1;
      return {
        name,
        avatarColor: ["#ffd93d", "#6db6fe", "#a8ecad", "#ffdad6", "#ffd0e4", "#d0e4ff"][i % 6],
        joinedAt: 0,
        groupId: gId,
        active: false,
        avatarIcon: ["face_6", "face_4", "sentiment_satisfied", "emoji_emotions", "face_2", "face_3"][i % 6],
      };
    });
    room.students = updatedStudents;
  }
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  console.log(`Updated room ${room.roomId} via Teacher Admin Edit`);
  res.json({ success: true, room });
});

// Update Group Collaborative Artifact
app.post("/api/rooms/:roomId/group/:groupId/artifact", (req, res) => {
  const { roomId, groupId } = req.params;
  const { artifactText } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  const group = room.groups.find(g => g.id === Number(groupId));
  if (!group) {
    res.status(400).json({ error: "모둠을 찾을 수 없습니다." });
    return;
  }
  
  group.artifactText = artifactText || "";
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, artifactText: group.artifactText });
});

// Teacher Google Login API - OAuth URL generator
app.get("/api/auth/google/url", (req, res) => {
  // google_client_id 소문자 폴백 추가
  const clientId = cleanEnvVar(
    process.env.GOOGLE_CLIENT_ID || 
    process.env.CLIENT_ID || 
    process.env.google_client_id
  );
  
  // Vercel/Production에서는 HTTPS 사용, 로컬에서는 HTTP
  const protocol = process.env.VERCEL_ENV === "production" || req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const host = req.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/auth/callback`;
  
  console.log(`🔐 OAuth Redirect URI: ${redirectUri}`);
  
  if (!clientId) {
    console.warn("⚠️ GOOGLE_CLIENT_ID not configured, using mock login");
    res.json({ useMock: true });
    return;
  }
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    access_type: "offline",
    prompt: "consent",
  });
  
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.json({ url });
});

// Teacher Google Login OAuth callback handler
app.get(["/auth/callback", "/auth/callback/", "/api/auth/callback", "/api/auth/callback/"], async (req, res) => {
  const { code } = req.query;
  let user = { name: "지연 선생님", email: "jinny142857@gmail.com", picture: "" };
  
  try {
    // google_client_id, google_client_seceret 소문자 및 오탈자 폴백 추가
    const clientId = cleanEnvVar(
      process.env.GOOGLE_CLIENT_ID || 
      process.env.CLIENT_ID || 
      process.env.google_client_id
    );
    const clientSecret = cleanEnvVar(
      process.env.GOOGLE_CLIENT_SECRET || 
      process.env.CLIENT_SECRET || 
      process.env.google_client_seceret || 
      process.env.google_client_secret
    );
    
    // Vercel/Production에서는 HTTPS 사용, 로컬에서는 HTTP
    const protocol = process.env.VERCEL_ENV === "production" || req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const host = req.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/auth/callback`;
    
    console.log(`🔐 OAuth Callback - Redirect URI: ${redirectUri}`);
    
    if (code && clientId && clientSecret) {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      
      const tokens = await tokenRes.json();
      if (tokens.id_token) {
        const payloadBase64 = tokens.id_token.split(".")[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));
        user = {
          name: payload.name || payload.given_name || "지연 선생님",
          email: payload.email || "jinny142857@gmail.com",
          picture: payload.picture || "",
        };
      }
    }
  } catch (err) {
    console.error("Google Token Exchange error:", err);
  }
  
  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h2>Google 로그인 성공</h2>
        <p>인증이 완료되었습니다. 이 창은 자동으로 닫힙니다.</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: "OAUTH_AUTH_SUCCESS", user: ${JSON.stringify(user)} }, "*");
            window.close();
          } else {
            localStorage.setItem("moa_teacher", JSON.stringify(${JSON.stringify(user)}));
            window.location.href = "/";
          }
        </script>
      </body>
    </html>
  `);
});

// Mock Interactive Google Login Popup Page
app.get("/auth/mock-google", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Sign in - Google Accounts</title>
        <meta charset="utf-8" />
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Roboto', sans-serif; }
        </style>
      </head>
      <body class="bg-slate-100 flex items-center justify-center min-h-screen">
        <div class="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center border border-slate-200">
          <div class="flex justify-center mb-4">
            <svg class="w-12 h-12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          </div>
          <h2 class="text-xl font-bold text-slate-800 mb-1">Google 계정으로 로그인</h2>
          <p class="text-xs text-slate-500 mb-6">모두 모아 (MOA) 교사용 계정 로그인</p>
          
          <div class="space-y-4 text-left">
            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-500">이메일 주소 입력</label>
              <div class="flex gap-2">
                <input type="email" id="custom-email" placeholder="example@gmail.com" class="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-500" />
                <button onclick="submitCustom()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors">로그인</button>
              </div>
            </div>
          </div>
          
          <p class="text-[10px] text-slate-400 mt-6 leading-relaxed">
            계속 진행하면 Google 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.
          </p>
        </div>
        
        <script>
          function selectUser(name, email) {
            const user = { name, email, picture: "" };
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user }, '*');
              window.close();
            } else {
              alert('부모 창이 없습니다.');
            }
          }
          function submitCustom() {
            const email = document.getElementById('custom-email').value;
            if (!email || !email.includes('@')) {
              alert('올바른 이메일 주소를 입력해주세요!');
              return;
            }
            const name = email.split('@')[0] + ' 선생님';
            selectUser(name, email);
          }
        </script>
      </body>
    </html>
  `);
});

// Join Room (Student Mode)
app.post("/api/rooms/:roomId/join", (req, res) => {
  const { roomId } = req.params;
  const { name, avatarColor, avatarIcon } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "존재하지 않거나 만료된 방 코드입니다." });
    return;
  }
  
  // Find matching student by name or register dynamic student
  let student = room.students.find((s) => s.name === name);
  
  if (student) {
    student.active = true;
    student.joinedAt = Date.now();
    if (avatarColor) student.avatarColor = avatarColor;
    if (avatarIcon) student.avatarIcon = avatarIcon;
  } else {
    // Dynamic admission
    // Calculate smallest group to assign (based on active group count)
    const activeGroupCount = room.groups?.length || room.groupCount || 6;
    const groupCounts = Array.from({ length: activeGroupCount }).map((_, i) => {
      const gId = i + 1;
      return room.students.filter((s) => s.groupId === gId).length;
    });
    const minGroupIdx = groupCounts.indexOf(Math.min(...groupCounts));
    const assignedGroup = minGroupIdx + 1;
    
    student = {
      name,
      avatarColor: avatarColor || "#ffd93d",
      joinedAt: Date.now(),
      groupId: assignedGroup,
      active: true,
      avatarIcon: avatarIcon || "face_6",
    };
    room.students.push(student);
  }
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  
  res.json({ success: true, student, room });
});

// Leave Lobby / Room
app.post("/api/rooms/:roomId/leave", (req, res) => {
  const { roomId } = req.params;
  const { name } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    const student = room.students.find((s) => s.name === name);
    if (student) {
      student.active = false;
      
      // Clean up current speaker if this student is speaker
      room.groups.forEach((g) => {
        if (g.currentSpeaker === name) {
          g.currentSpeaker = null;
        }
      });
      
      saveRooms();
      broadcastRoomUpdate(room.roomId);
    }
  }
  res.json({ success: true });
});

// Simulate joining all remaining inactive students for testing (Teacher Mode utility)
app.post("/api/rooms/:roomId/simulate-join-all", (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "존재하지 않는 방 코드입니다." });
    return;
  }
  
  room.students.forEach((s) => {
    if (!s.active) {
      s.active = true;
      s.joinedAt = Date.now();
    }
  });
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, room });
});

// Simulate adding mock post-it activity to test board view
app.post("/api/rooms/:roomId/simulate-activity", (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "존재하지 않는 방 코드입니다." });
    return;
  }

  const sampleIdeas = [
    "양치할 때 양치컵 사용해서 물 아끼기",
    "사용하지 않는 가전제품 대기전력 코드 뽑아두기",
    "학교 급식 남기지 않고 골고루 다 먹기",
    "장보기 전 장바구니나 에코백 미리 챙기기",
    "가까운 거리는 대중교통 대신 걷거나 자전거 타기",
    "일회용 컵 대신 개인 텀블러 소지하고 다니기",
    "가정이나 학교에서 이면지 모아서 연습장 만들기",
    "분리배출 가이드라인 맞춰 꼼꼼하게 배출하기",
    "샤워 시간 3분 줄여 소중한 수자원 절약하기",
    "비닐봉지 사용 일체 멈추고 다회용 백 쓰기",
    "빈 교실이나 집 안 쓰지 않는 방의 불 꼭 끄기",
    "재사용 가능한 작아진 옷이나 신발 기부하기"
  ];

  const colors = ["#FEF08A", "#DBEAFE", "#D1FAE5", "#FFE4E6"];

  room.students.forEach((s) => {
    // Make s active if not
    s.active = true;
    if (s.joinedAt === 0) {
      s.joinedAt = Date.now();
    }
    
    const group = room.groups.find((g) => g.id === s.groupId);
    if (group) {
      // Check if student already posted
      const hasPosted = group.postits.some((p) => p.studentName === s.name);
      if (!hasPosted) {
        const text = sampleIdeas[Math.floor(Math.random() * sampleIdeas.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        group.postits.push({
          id: Math.random().toString(36).substring(2, 9),
          studentName: s.name,
          text,
          color,
          likes: Math.floor(Math.random() * 5),
          sttCorrected: Math.random() > 0.5,
          createdAt: Date.now()
        });
      }
    }
  });

  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, room });
});

// Get Room State
app.get("/api/rooms/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  res.json(room);
});

// SSE Event Stream for Real-time Sync
app.get("/api/rooms/:roomId/events", (req, res) => {
  const { roomId } = req.params;
  const rId = roomId.toUpperCase();
  const room = rooms[rId];
  
  if (!room) {
    res.status(404).end();
    return;
  }
  
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  
  addSseClient(rId, res);
  
  // Send initial room state
  res.write(`data: ${JSON.stringify(room)}\n\n`);
  
  // Heartbeat to prevent socket close
  const intervalId = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);
  
  req.on("close", () => {
    clearInterval(intervalId);
    removeSseClient(rId, res);
  });
});

// Post-it Sticky Note addition
app.post("/api/rooms/:roomId/postit", async (req, res) => {
  const { roomId } = req.params;
  const { groupId, studentName, text, color } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  const group = room.groups.find((g) => g.id === Number(groupId));
  if (!group) {
    res.status(400).json({ error: "모둠을 찾을 수 없습니다." });
    return;
  }

  // Calculate current questionId based on currentStepIndex
  let questionId = 0;
  const questionsCount = room.questions?.length || 1;
  if (room.currentStepIndex >= 1 && room.currentStepIndex <= questionsCount * 2) {
    questionId = Math.floor((room.currentStepIndex - 1) / 2);
  }
  
  const newPostIt: PostIt = {
    id: Math.random().toString(36).substring(2, 9),
    studentName,
    text,
    color: color || "#ffd93d",
    likes: 0,
    sttCorrected: false,
    createdAt: Date.now(),
    questionId,
  };
  
  group.postits.push(newPostIt);
  
  // Adjust group activity level
  if (group.postits.length > 5) {
    group.activityLevel = "high";
    group.activityStatus = "Active";
  } else if (group.postits.length > 0) {
    group.activityLevel = "medium";
    group.activityStatus = "Active";
  }
  
  await saveRooms();
  
  // Supabase에 포스트잇 저장
  if (supabase) {
    try {
      await supabase.from("postits").insert({
        id: newPostIt.id,
        room_id: room.roomId,
        group_id: groupId,
        student_name: studentName,
        text: text,
        color: color || "#ffd93d",
        stt_corrected: false,
        question_id: questionId,
      });
    } catch (err) {
      console.error("Failed to save postit to Supabase:", err);
    }
  }
  
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, postit: newPostIt });
});

// Post-it Like increment
app.post("/api/rooms/:roomId/postit/like", async (req, res) => {
  const { roomId } = req.params;
  const { groupId, postitId } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    const group = room.groups.find((g) => g.id === Number(groupId));
    if (group) {
      const postit = group.postits.find((p) => p.id === postitId);
      if (postit) {
        postit.likes += 1;
        await saveRooms();
        
        // Supabase에 라이크 업데이트
        if (supabase) {
          try {
            await supabase
              .from("postits")
              .update({ likes: postit.likes })
              .eq("id", postitId);
          } catch (err) {
            console.error("Failed to update likes in Supabase:", err);
          }
        }
        
        broadcastRoomUpdate(room.roomId);
        res.json({ success: true, likes: postit.likes });
        return;
      }
    }
  }
  res.status(400).json({ error: "실패" });
});

// Post-it deletion
app.post("/api/rooms/:roomId/postit/delete", async (req, res) => {
  const { roomId } = req.params;
  const { groupId, postitId } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    const group = room.groups.find((g) => g.id === Number(groupId));
    if (group) {
      group.postits = group.postits.filter((p) => p.id !== postitId);
      await saveRooms();
      
      // Supabase에서 삭제
      if (supabase) {
        try {
          await supabase.from("postits").delete().eq("id", postitId);
        } catch (err) {
          console.error("Failed to delete postit from Supabase:", err);
        }
      }
      
      broadcastRoomUpdate(room.roomId);
      res.json({ success: true });
      return;
    }
  }
  res.status(400).json({ error: "실패" });
});

// Move phase / Step controls
app.post("/api/rooms/:roomId/step", (req, res) => {
  const { roomId } = req.params;
  const { stepIndex } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  room.currentStepIndex = Number(stepIndex);
  
  // Set dynamic Timer and Phase names based on questions count
  const questionsCount = room.questions?.length || 1;
  let duration = 180; // default 3 mins
  let phaseName = "토의 진행";

  if (room.currentStepIndex === 0) {
    duration = 180;
    phaseName = "대기실 로비";
  } else if (room.currentStepIndex >= 1 && room.currentStepIndex <= questionsCount * 2) {
    const zeroIndexedStep = room.currentStepIndex - 1;
    const questionIndex = Math.floor(zeroIndexedStep / 2);
    const stageIndex = zeroIndexedStep % 2;

    if (stageIndex === 0) {
      duration = 240; // 토의 진행 4분
      phaseName = `질문 ${questionIndex + 1}: 토의 진행`;
      // 새 질문 단계가 시작될 때마다 모든 모둠의 발표자 추첨 기록을 초기화합니다.
      room.groups.forEach((g) => {
        g.currentSpeaker = null;
        g.drawnSpeakers = [];
      });
    } else if (stageIndex === 1) {
      duration = 300; // 생각 모으기 5분
      phaseName = `질문 ${questionIndex + 1}: 생각 모으기`;
    }
  } else if (room.hasVote && room.currentStepIndex === questionsCount * 2 + 1) {
    duration = 120; // 미니 투표 2분
    phaseName = "미니 투표 진행";
  } else {
    duration = 180;
    phaseName = "토의 마침";
  }
  
  room.timerDuration = duration;
  room.timerLeft = duration;
  room.timerActive = false; // pause initially
  
  room.groups.forEach((g) => {
    g.phase = phaseName;
    // Clear alerts on phase change
    g.alertMessage = null;
    g.alertType = null;
  });
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, room });
});

// Master Remote Quiet Mode Toggle
app.post("/api/rooms/:roomId/quiet", (req, res) => {
  const { roomId } = req.params;
  const { isQuietMode } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  room.isQuietMode = Boolean(isQuietMode);
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, isQuietMode: room.isQuietMode });
});

// Timer Play / Pause
app.post("/api/rooms/:roomId/timer/toggle", (req, res) => {
  const { roomId } = req.params;
  const { active } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    room.timerActive = Boolean(active);
    saveRooms();
    broadcastRoomUpdate(room.roomId);
    res.json({ success: true, timerActive: room.timerActive });
  } else {
    res.status(404).end();
  }
});

// Timer Reset
app.post("/api/rooms/:roomId/timer/reset", (req, res) => {
  const { roomId } = req.params;
  const { duration } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    if (duration) room.timerDuration = duration;
    room.timerLeft = room.timerDuration;
    room.timerActive = false;
    saveRooms();
    broadcastRoomUpdate(room.roomId);
    res.json({ success: true, room });
  } else {
    res.status(404).end();
  }
});

// Relay random speaker selection (draw speaker)
app.post("/api/rooms/:roomId/draw", (req, res) => {
  const { roomId } = req.params;
  const { groupId } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  const group = room.groups.find((g) => g.id === Number(groupId));
  if (!group) {
    res.status(400).json({ error: "모둠을 찾을 수 없습니다." });
    return;
  }
  
  // Find joined students in this group
  const groupMembers = room.students.filter((s) => s.groupId === group.id && s.active);
  const memberNames = groupMembers.map((m) => m.name);
  
  if (memberNames.length === 0) {
    res.status(400).json({ error: "모둠에 참여 중인 학생이 없습니다." });
    return;
  }
  
  // Eligible candidates (not drawn yet)
  let candidates = memberNames.filter((name) => !group.drawnSpeakers.includes(name));
  
  // If everyone has spoken, reset history and draw from everyone
  if (candidates.length === 0) {
    group.drawnSpeakers = [];
    candidates = memberNames;
  }
  
  // Choose random candidate
  const speaker = candidates[Math.floor(Math.random() * candidates.length)];
  group.currentSpeaker = speaker;
  group.drawnSpeakers.push(speaker);
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, speaker, drawnSpeakers: group.drawnSpeakers });
});

// Pass Speaker (Relay selector)
app.post("/api/rooms/:roomId/pass", (req, res) => {
  const { roomId } = req.params;
  const { groupId } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  const group = room.groups.find((g) => g.id === Number(groupId));
  if (!group) {
    res.status(400).json({ error: "모둠을 찾을 수 없습니다." });
    return;
  }
  
  if (group.passTickets <= 0) {
    res.status(400).json({ error: "남은 패스 티켓이 없습니다!" });
    return;
  }
  
  const passedSpeaker = group.currentSpeaker;
  if (!passedSpeaker) {
    res.status(400).json({ error: "현재 발표자가 지정되지 않았습니다." });
    return;
  }
  
  // Deduct ticket
  group.passTickets -= 1;
  
  // Remove from drawn speaker history so they can be drawn again
  group.drawnSpeakers = group.drawnSpeakers.filter((name) => name !== passedSpeaker);
  group.currentSpeaker = null;
  
  // Perform next random draw automatically
  const groupMembers = room.students.filter((s) => s.groupId === group.id && s.active);
  const memberNames = groupMembers.map((m) => m.name);
  let candidates = memberNames.filter((name) => !group.drawnSpeakers.includes(name));
  
  if (candidates.length > 0) {
    const nextSpeaker = candidates[Math.floor(Math.random() * candidates.length)];
    group.currentSpeaker = nextSpeaker;
    group.drawnSpeakers.push(nextSpeaker);
  }
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, passedSpeaker, nextSpeaker: group.currentSpeaker });
});

// Teacher remote interventions (주의주기, 격려하기)
app.post("/api/rooms/:roomId/alert", (req, res) => {
  const { roomId } = req.params;
  const { groupId, alertType, alertMessage } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  // Handle specific group or all groups
  if (groupId === "all") {
    room.groups.forEach((g) => {
      g.alertType = alertType;
      g.alertMessage = alertMessage;
    });
  } else {
    const group = room.groups.find((g) => g.id === Number(groupId));
    if (group) {
      group.alertType = alertType;
      group.alertMessage = alertMessage;
      
      // If Warning, change status for UI effect
      if (alertType === "warning") {
        group.activityStatus = "No activity (3 mins)";
        group.activityLevel = "low";
      }
    }
  }
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true });
});

// Clears active group alert
app.post("/api/rooms/:roomId/alert/clear", (req, res) => {
  const { roomId } = req.params;
  const { groupId } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    const group = room.groups.find((g) => g.id === Number(groupId));
    if (group) {
      group.alertType = null;
      group.alertMessage = null;
      if (group.activityLevel === "low") {
        group.activityLevel = "medium";
        group.activityStatus = "Active";
      }
      saveRooms();
      broadcastRoomUpdate(room.roomId);
    }
  }
  res.json({ success: true });
});

// Start Mini-voting inside a Group (or global)
app.post("/api/rooms/:roomId/vote/start", (req, res) => {
  const { roomId } = req.params;
  const { groupId, question, options } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  const targetGroups = groupId === "all" ? room.groups : room.groups.filter((g) => g.id === Number(groupId));
  
  const voteSession = {
    question: question || "가장 좋은 실천 의견에 투표해주세요!",
    options: options.map((opt: string, i: number) => ({
      id: String(i + 1),
      text: opt,
      count: 0,
    })),
    active: true,
    votedStudents: [],
  };
  
  targetGroups.forEach((g) => {
    g.activeVote = JSON.parse(JSON.stringify(voteSession)); // clone
  });
  
  saveRooms();
  broadcastRoomUpdate(room.roomId);
  res.json({ success: true, voteSession });
});

// Submit Vote
app.post("/api/rooms/:roomId/vote/submit", (req, res) => {
  const { roomId } = req.params;
  const { groupId, studentName, optionId } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (!room) {
    res.status(404).json({ error: "방을 찾을 수 없습니다." });
    return;
  }
  
  const group = room.groups.find((g) => g.id === Number(groupId));
  if (group && group.activeVote && group.activeVote.active) {
    // Avoid double votes
    if (group.activeVote.votedStudents.includes(studentName)) {
      res.status(400).json({ error: "이미 투표에 참여했습니다." });
      return;
    }
    
    const option = group.activeVote.options.find((o) => o.id === String(optionId));
    if (option) {
      option.count += 1;
      group.activeVote.votedStudents.push(studentName);
      saveRooms();
      broadcastRoomUpdate(room.roomId);
      res.json({ success: true, voteSession: group.activeVote });
      return;
    }
  }
  res.status(400).json({ error: "투표가 종료되었거나 존재하지 않습니다." });
});

// End Mini-voting
app.post("/api/rooms/:roomId/vote/end", (req, res) => {
  const { roomId } = req.params;
  const { groupId } = req.body;
  
  const room = rooms[roomId.toUpperCase()];
  if (room) {
    const targetGroups = groupId === "all" ? room.groups : room.groups.filter((g) => g.id === Number(groupId));
    targetGroups.forEach((g) => {
      if (g.activeVote) {
        g.activeVote.active = false;
      }
    });
    saveRooms();
    broadcastRoomUpdate(room.roomId);
  }
  res.json({ success: true });
});

// AI Gemini speech typo/grammar corrector (STT Corrector)
app.post("/api/rooms/:roomId/stt-correct", async (req, res) => {
  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: "변환할 텍스트가 없습니다." });
    return;
  }
  
  const client = getGeminiClient();
  if (!client) {
    // Gemini key not active, fallback gracefully
    console.log("Gemini API key is not configured, running standard local filter.");
    // Mock correction by just trimming or simple correction rules
    res.json({ correctedText: text });
    return;
  }
  
  try {
    const systemInstruction = `너는 초등학교 모둠 토론 수업을 돕는 보조 인공지능이야. 
초등학교 저학년 및 중학년 학생들이 음성 인식(STT)으로 말한 의견 텍스트를 정제하고 다듬어 줘. 
의미가 통하도록 받아쓰기 오타, 띄어쓰기, 조사를 바로잡아 매우 깔끔한 한 문장으로 교정해야 해. 
원래 학생이 표현하고자 했던 본래 의도와 핵심 단어는 절대 훼손하지 말고 자연스러운 초등학생 말투(문체)로 다듬어 줘.
출력할 때는 부가 설명이나 코멘트 없이 딱 한 줄의 정제된 의견 텍스트만 출력해라.`;

    const prompt = `교정할 학생의 발언 텍스트: "${text}"`;
    
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });
    
    const correctedText = response.text ? response.text.trim().replace(/^"|"$/g, "") : text;
    console.log(`Gemini Corrected: "${text}" -> "${correctedText}"`);
    res.json({ correctedText });
  } catch (e: any) {
    console.error("Gemini correction error:", e);
    // Fallback on failure
    res.json({ correctedText: text, error: e.message });
  }
});

// ================= VITE DEV / PRODUCTION FLOW =================

async function startServer() {
  app.get("/api/이용약관.md", (req, res) => {
    const filePath = path.join(process.cwd(), "이용약관.md");
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) return res.status(404).send("이용약관 파일을 찾을 수 없습니다.");
      res.type("text/plain; charset=utf-8").send(data);
    });
  });

  app.get("/api/개인정보처리방침.md", (req, res) => {
    const filePath = path.join(process.cwd(), "개인정보처리방침.md");
    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) return res.status(404).send("개인정보처리방침 파일을 찾을 수 없습니다.");
      res.type("text/plain; charset=utf-8").send(data);
    });
  });

  if (process.env.VERCEL !== "1") {
    if (process.env.NODE_ENV !== "production") {
      // Integrate Vite in development mode
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware mounted successfully.");
    } else {
      // Production serving of static compiled files
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
      console.log("Serving production build from dist directory.");
    }
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[MOA Server] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
    });
  }
}

startServer();

export default app;

