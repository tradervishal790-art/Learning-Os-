// firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, logEvent, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBgRq-CzcRNch6hN9PU6OooS5dw7gd_e2M",
  authDomain: "learning--os.firebaseapp.com",
  projectId: "learning--os",
  storageBucket: "learning--os.firebasestorage.app",
  messagingSenderId: "785996259006",
  appId: "1:785996259006:web:0d79f664c7a93588b988ef",
  measurementId: "G-9B9J8LS2W1"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Auth & Firestore (future use ke liye ready — abhi Auth use nahi ho raha)
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics — browser-only, isliye async support-check ke baad init karte hain
let analytics: Analytics | undefined;

isSupported()
  .then((supported: boolean) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {
    // Analytics blocked ho sakta hai (adblocker, unsupported env) — app ko crash nahi karna
  });

// ---------- Helper: safe event tracker ----------
// Ye function har jagah use hoga, analytics null hone par bhi crash nahi karega
function track(eventName: string, params?: Record<string, unknown>) {
  if (analytics) {
    logEvent(analytics, eventName, params);
  }
}

// ---------- Learning OS specific events ----------

// 1. Onboarding complete hone par (name, role, goal, language collect hota hai)
export function trackOnboardingComplete(data: {
  name: string;
  role?: string;
  goal?: string;
  language?: string;
}) {
  track("onboarding_complete", {
    user_name: data.name,
    role: data.role,
    goal: data.goal,
    language: data.language,
  });
}

// 2. Quiz complete hone par (LearningQuiz.tsx)
export function trackQuizComplete(reliabilityScore: number) {
  track("quiz_complete", { reliability_score: reliabilityScore });
}

// 3. Video watch karne par (VideoIntel.tsx)
export function trackVideoWatch(videoId: string, teacherName?: string) {
  track("video_watch", { video_id: videoId, teacher: teacherName });
}

// 4. Deep Notes generate hone par (Notes.tsx)
export function trackNotesGenerated(topic: string) {
  track("notes_generated", { topic });
}

// 5. Mentor se chat karne par (Mentor.tsx)
export function trackMentorChat(messageCount: number) {
  track("mentor_chat", { message_count: messageCount });
}

// 6. Roadmap generate hone par
export function trackRoadmapGenerated(success: boolean) {
  track("roadmap_generated", { success });
}

// 7. Dashboard page open hone par (returning user)
export function trackDashboardOpen() {
  track("dashboard_open");
}

// Generic fallback — kisi bhi custom event ke liye
export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  track(eventName, params);
}

export default app;