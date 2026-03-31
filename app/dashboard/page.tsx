/**
 * app/dashboard/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Fully responsive dashboard — mobile, tablet, desktop
 * Features: dark mode, search, export, typing indicator,
 * auto-follow-up UI, read/unread, manual reply, AI toggle,
 * notes, tags, stats, notifications
 * ─────────────────────────────────────────────────────────────
 */

"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  memo,
  type KeyboardEvent,
} from "react";
import { INTENT_COLOURS, INTENT_LABELS, type Intent } from "@/lib/intents";
import type { PatientSummary } from "@/app/api/patients/route";
import type { MessageRow, PatientMeta } from "@/lib/supabase";
import type { DashboardStats } from "@/app/api/stats/route";

// ── Types ─────────────────────────────────────────────────────
type MobileView = "list" | "thread" | "details";
type Theme = "light" | "dark";

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  return isToday
    ? time
    : `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} ${time}`;
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function Skeleton({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ backgroundColor: "var(--border)" }}
    />
  );
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch { /* not supported */ }
}

const AVAILABLE_TAGS = [
  "Follow up needed", "Booked", "VIP",
  "Price-sensitive", "New patient", "Emergency",
];

const INTENT_LABEL_MAP: Record<string, string> = {
  booking_request: "Booking", pricing_query: "Pricing",
  treatment_question: "Treatment", emergency: "Emergency",
  post_treatment_care: "Aftercare", hours_location: "Hours/Location",
  insurance_payment: "Insurance", general: "General",
};

// ── Typing indicator bubble ───────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex flex-col items-start" style={{ marginTop: 16 }}>
      <div
        className="flex items-center gap-1 px-3 py-2"
        style={{
          backgroundColor: "var(--bg-inbound)",
          borderRadius: 4,
          minWidth: 52,
        }}
      >
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span
        className="text-[11px] mt-0.5"
        style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
      >
        AI is thinking...
      </span>
    </div>
  );
}

// ── Message bubble (memoised) ─────────────────────────────────
const MessageBubble = memo(function MessageBubble({
  msg, showGap,
}: {
  msg: MessageRow; showGap: boolean;
}) {
  const isOut = msg.direction === "outbound";
  return (
    <div
      className={`flex flex-col ${isOut ? "items-end" : "items-start"}`}
      style={{ marginTop: showGap ? 16 : 4 }}
    >
      <div
        className="text-[14px] leading-relaxed"
        style={{
          backgroundColor: isOut ? "var(--accent)" : "var(--bg-inbound)",
          color: isOut ? "var(--accent-text)" : "var(--text-primary)",
          borderRadius: 4,
          padding: "8px 12px",
          maxWidth: "min(70%, 480px)",
          wordBreak: "break-word",
        }}
      >
        {msg.content}
      </div>
      <div className="flex items-center gap-1 mt-0.5">
        <span
          className="text-[11px]"
          style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {formatTime(msg.created_at ?? "")}
        </span>
        {isOut && (
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            · {msg.is_ai ? "AI" : "Staff"}
          </span>
        )}
      </div>
    </div>
  );
});

// ── Conversation row (memoised) ───────────────────────────────
const ConversationRow = memo(function ConversationRow({
  patient, isSelected, onClick,
}: {
  patient: PatientSummary; isSelected: boolean; onClick: () => void;
}) {
  const colour = INTENT_COLOURS[patient.lastIntent as Intent] ?? "#9CA3AF";
  const hasUnread = (patient.unreadCount ?? 0) > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 transition-colors duration-150"
      style={{
        backgroundColor: isSelected ? "var(--bg-selected)" : "transparent",
        borderBottom: "1px solid var(--border)",
        borderLeft: isSelected ? "3px solid var(--accent)" : "3px solid transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 rounded-full"
            style={{ width: 8, height: 8, backgroundColor: colour }}
          />
          <span
            className="text-[14px] truncate"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: hasUnread ? 700 : 400,
              color: "var(--text-primary)",
            }}
          >
            {patient.phone}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasUnread && (
            <span
              className="text-[11px] text-white rounded-full px-1.5 py-0.5 font-bold"
              style={{ backgroundColor: "var(--unread-bg)" }}
            >
              {patient.unreadCount}
            </span>
          )}
          <span
            className="text-[12px]"
            style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {timeAgo(patient.lastMessageAt)}
          </span>
        </div>
      </div>
      <p
        className="text-[13px] truncate mt-0.5 pl-4"
        style={{
          color: hasUnread ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: hasUnread ? 500 : 400,
        }}
      >
        {patient.lastMessage}
      </p>
    </button>
  );
});

// ── Stat pill ─────────────────────────────────────────────────
function StatPill({ label, value, colour }: {
  label: string; value: number; colour: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="font-bold text-[18px]"
        style={{ color: colour, fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {value}
      </span>
      <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  // ── State ───────────────────────────────────────────────────
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selected, setSelected] = useState<PatientSummary | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [meta, setMeta] = useState<PatientMeta | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MessageRow[]>([]);
  const [searchMode, setSearchMode] = useState(false);
  const [searching, setSearching] = useState(false);
  const [manualMsg, setManualMsg] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [newTag, setNewTag] = useState("");
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingManual, setSendingManual] = useState(false);
  const [sendingBooking, setSendingBooking] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "notes">("details");
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [theme, setTheme] = useState<Theme>("light");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [aiTyping, setAiTyping] = useState(false);
  const [notifPermission, setNotifPermission] =
    useState<NotificationPermission>("default");
  const [exportingCSV, setExportingCSV] = useState(false);

  // ── Refs ─────────────────────────────────────────────────────
  const selectedRef = useRef<PatientSummary | null>(null);
  const messagesRef = useRef<MessageRow[]>([]);
  const patientsRef = useRef<PatientSummary[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  selectedRef.current = selected;
  messagesRef.current = messages;
  patientsRef.current = patients;

  // ── Theme init ───────────────────────────────────────────────
  useEffect(() => {
    const saved = (localStorage.getItem("dashboard-theme") as Theme) ?? "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("dashboard-theme", next);
  }

  // ── Notification permission ──────────────────────────────────
  useEffect(() => {
    if ("Notification" in window) setNotifPermission(Notification.permission);
  }, []);

  async function requestNotifPermission() {
    if ("Notification" in window) {
      const p = await Notification.requestPermission();
      setNotifPermission(p);
    }
  }

  // ── Scroll helpers ───────────────────────────────────────────
  function scrollToBottom(smooth = true) {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }

  function handleScroll() {
    const el = threadRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }

  // ── SMART patient polling ────────────────────────────────────
  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch("/api/patients");
      if (!res.ok) return;
      const fresh: PatientSummary[] = await res.json();
      const current = patientsRef.current;
      const currentMap = new Map(current.map((p) => [p.phone, p]));
      let hasChanges = fresh.length !== current.length;

      for (const p of fresh) {
        const prev = currentMap.get(p.phone);
        const isCurrentlySelected = selectedRef.current?.phone === p.phone;

        if (prev && p.totalMessages > prev.totalMessages && !isCurrentlySelected) {
          playNotificationSound();
          if (notifPermission === "granted") {
            new Notification("New message — Bright Smile Dental", {
              body: `${p.phone}: ${p.lastMessage.substring(0, 60)}`,
              icon: "/favicon.ico",
            });
          }
        }

        if (
          !prev ||
          p.totalMessages !== prev.totalMessages ||
          p.unreadCount !== prev.unreadCount ||
          p.lastIntent !== prev.lastIntent
        ) hasChanges = true;
      }

      if (hasChanges) {
        setPatients(fresh);
        if (selectedRef.current) {
          const updated = fresh.find((p) => p.phone === selectedRef.current!.phone);
          if (updated) {
            setSelected((prev) => prev
              ? { ...prev, totalMessages: updated.totalMessages, unreadCount: updated.unreadCount, lastMessageAt: updated.lastMessageAt }
              : prev
            );
          }
        }
      }
    } finally {
      if (!initialLoadDone.current) {
        setLoadingPatients(false);
        initialLoadDone.current = true;
      }
    }
  }, [notifPermission]);

  // ── SMART message polling — appends only ─────────────────────
  const fetchNewMessages = useCallback(async () => {
    const phone = selectedRef.current?.phone;
    if (!phone) return;
    const current = messagesRef.current;
    const lastMsg = current[current.length - 1];
    const url = lastMsg?.created_at
      ? `/api/messages/${encodeURIComponent(phone)}?after=${encodeURIComponent(lastMsg.created_at)}`
      : `/api/messages/${encodeURIComponent(phone)}`;

    const res = await fetch(url).catch(() => null);
    if (!res?.ok) return;
    const incoming: MessageRow[] = await res.json();

    const newOnes = lastMsg
      ? incoming.filter(
          (m) => m.id !== lastMsg.id &&
            new Date(m.created_at ?? 0) > new Date(lastMsg.created_at ?? 0)
        )
      : incoming;

    if (newOnes.length === 0) return;

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const toAdd = newOnes.filter((m) => !existingIds.has(m.id));
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });

    if (isAtBottom) setTimeout(() => scrollToBottom(true), 50);
  }, [isAtBottom]);

  // ── Typing indicator polling ─────────────────────────────────
  const pollTyping = useCallback(async () => {
    const phone = selectedRef.current?.phone;
    if (!phone) return;
    const res = await fetch(`/api/typing-status?phone=${encodeURIComponent(phone)}`).catch(() => null);
    if (res?.ok) {
      const { typing } = await res.json();
      setAiTyping(typing);
    }
  }, []);

  // ── Initial message load ─────────────────────────────────────
  const loadAllMessages = useCallback(async (phone: string) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(phone)}`);
      if (res.ok) {
        const data: MessageRow[] = await res.json();
        setMessages(data);
        setTimeout(() => scrollToBottom(false), 50);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ── Fetch stats ──────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/stats").catch(() => null);
    if (res?.ok) setStats(await res.json());
  }, []);

  // ── Fetch meta ───────────────────────────────────────────────
  const fetchMeta = useCallback(async (phone: string) => {
    const res = await fetch(`/api/patient-meta/${encodeURIComponent(phone)}`).catch(() => null);
    if (res?.ok) {
      const data: PatientMeta = await res.json();
      setMeta(data);
      setNotesInput(data.notes ?? "");
    }
  }, []);

  // ── Polling intervals ────────────────────────────────────────
  useEffect(() => {
    fetchPatients();
    fetchStats();
    const pInterval = setInterval(fetchPatients, 4000);
    const sInterval = setInterval(fetchStats, 30000);
    return () => { clearInterval(pInterval); clearInterval(sInterval); };
  }, [fetchPatients, fetchStats]);

  useEffect(() => {
    if (!selected) return;
    const mInterval = setInterval(fetchNewMessages, 3000);
    const tInterval = setInterval(pollTyping, 2000);
    return () => { clearInterval(mInterval); clearInterval(tInterval); };
  }, [selected, fetchNewMessages, pollTyping]);

  // ── Auto-scroll when typing indicator changes ────────────────
  useEffect(() => {
    if (aiTyping && isAtBottom) setTimeout(() => scrollToBottom(true), 50);
  }, [aiTyping, isAtBottom]);

  // ── Search with debounce ─────────────────────────────────────
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setSearchResults([]);
      setSearchMode(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchMode(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(search)}`);
        if (res.ok) setSearchResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [search]);

  // ── Select patient ───────────────────────────────────────────
  async function selectPatient(patient: PatientSummary) {
    setSelected(patient);
    setMeta(null);
    setNotesInput("");
    setActiveTab("details");
    setIsAtBottom(true);
    setAiTyping(false);
    setMobileView("thread");
    loadAllMessages(patient.phone);
    fetchMeta(patient.phone);

    await fetch("/api/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: patient.phone }),
    });

    setPatients((prev) =>
      prev.map((p) => p.phone === patient.phone ? { ...p, unreadCount: 0 } : p)
    );
  }

  // ── Send manual message ──────────────────────────────────────
  async function sendManual() {
    if (!selected || !manualMsg.trim()) return;
    setSendingManual(true);
    const optimistic: MessageRow = {
      id: `opt-${Date.now()}`,
      patient_phone: selected.phone,
      direction: "outbound",
      content: manualMsg.trim(),
      intent: "general",
      is_ai: false,
      is_read: true,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const msgText = manualMsg.trim();
    setManualMsg("");
    setTimeout(() => scrollToBottom(true), 50);
    try {
      await fetch("/api/send-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selected.phone, message: msgText }),
      });
    } finally {
      setSendingManual(false);
    }
  }

  function handleManualKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendManual(); }
  }

  // ── Send booking link ────────────────────────────────────────
  async function sendBooking() {
    if (!selected) return;
    setSendingBooking(true);
    try {
      await fetch("/api/send-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selected.phone }),
      });
    } finally {
      setSendingBooking(false);
    }
  }

  // ── Export CSV ───────────────────────────────────────────────
  async function exportCSV() {
    if (!selected) return;
    setExportingCSV(true);
    try {
      const res = await fetch(
        `/api/export?phone=${encodeURIComponent(selected.phone)}&format=csv`
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversation-${selected.phone}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCSV(false);
    }
  }

  // ── Toggle AI ────────────────────────────────────────────────
  async function toggleAI() {
    if (!selected || !meta) return;
    const newVal = !meta.ai_enabled;
    setMeta({ ...meta, ai_enabled: newVal });
    await fetch(`/api/patient-meta/${encodeURIComponent(selected.phone)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_enabled: newVal }),
    });
  }

  // ── Save notes ───────────────────────────────────────────────
  async function saveNotes() {
    if (!selected) return;
    setSavingNotes(true);
    await fetch(`/api/patient-meta/${encodeURIComponent(selected.phone)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesInput }),
    });
    setMeta((m) => m ? { ...m, notes: notesInput } : m);
    setSavingNotes(false);
  }

  // ── Tags ─────────────────────────────────────────────────────
  async function addTag(tag: string) {
    if (!selected || !meta || meta.tags.includes(tag)) return;
    const updated = [...meta.tags, tag];
    setMeta({ ...meta, tags: updated });
    await fetch(`/api/patient-meta/${encodeURIComponent(selected.phone)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: updated }),
    });
    setNewTag("");
  }

  async function removeTag(tag: string) {
    if (!selected || !meta) return;
    const updated = meta.tags.filter((t) => t !== tag);
    setMeta({ ...meta, tags: updated });
    await fetch(`/api/patient-meta/${encodeURIComponent(selected.phone)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: updated }),
    });
  }

  function copyPhone() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Derived ──────────────────────────────────────────────────
  const filtered = searchMode
    ? []
    : patients.filter((p) => p.phone.toLowerCase().includes(search.toLowerCase()));

  const uniqueIntents: Intent[] = selected
    ? ([...new Set(messages.map((m) => m.intent as Intent).filter(Boolean))] as Intent[])
    : [];

  const totalUnread = patients.reduce((s, p) => s + (p.unreadCount ?? 0), 0);

  // ── Shared panel components ──────────────────────────────────

  // Left panel content
  const LeftPanel = (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--bg-secondary)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="font-bold text-[16px]"
            style={{ color: "var(--text-primary)" }}
          >
            Conversations
          </span>
          <span
            className="text-[12px] text-white rounded px-1.5 py-0.5"
            style={{ backgroundColor: "var(--accent)" }}
          >
            {patients.length}
          </span>
          {totalUnread > 0 && (
            <span
              className="text-[12px] text-white rounded-full px-1.5 py-0.5 ml-auto font-bold"
              style={{ backgroundColor: "var(--unread-bg)" }}
            >
              {totalUnread}
            </span>
          )}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations or messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-[13px] rounded-sm outline-none"
            style={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-primary)",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          />
          {search && (
            <button
              onClick={() => { setSearch(""); setSearchMode(false); setSearchResults([]); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[16px]"
              style={{ color: "var(--text-muted)" }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {searchMode ? (
          /* Search results */
          <div>
            <div
              className="px-4 py-2 text-[11px] uppercase font-semibold"
              style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}
            >
              {searching ? "Searching..." : `${searchResults.length} results`}
            </div>
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => {
                  const p = patients.find((pt) => pt.phone === r.patient_phone);
                  if (p) { selectPatient(p); setSearch(""); setSearchMode(false); }
                }}
                className="w-full text-left px-4 py-3 transition-colors"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <p
                  className="text-[13px] font-medium"
                  style={{ color: "var(--text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {r.patient_phone}
                </p>
                <p
                  className="text-[12px] mt-0.5 line-clamp-2"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {r.content}
                </p>
                <p
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {formatTime(r.created_at ?? "")} · {r.direction}
                </p>
              </button>
            ))}
            {!searching && searchResults.length === 0 && (
              <p
                className="text-[14px] text-center mt-8"
                style={{ color: "var(--text-muted)" }}
              >
                No results found
              </p>
            )}
          </div>
        ) : loadingPatients ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-36 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p
            className="text-[14px] text-center mt-8"
            style={{ color: "var(--text-muted)" }}
          >
            No conversations yet
          </p>
        ) : (
          filtered.map((patient) => (
            <ConversationRow
              key={patient.phone}
              patient={patient}
              isSelected={selected?.phone === patient.phone}
              onClick={() => selectPatient(patient)}
            />
          ))
        )}
      </div>
    </div>
  );

  // Middle panel content
  const MiddlePanel = (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {selected ? (
        <>
          {/* Thread header */}
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {/* Back button — tablet/mobile */}
              <button
                className="md:hidden shrink-0 p-1 rounded"
                style={{ color: "var(--accent)" }}
                onClick={() => setMobileView("list")}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0">
                <p
                  className="text-[15px] font-bold truncate"
                  style={{ color: "var(--text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {selected.phone}
                </p>
                <p
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  First contact: {new Date(selected.firstContactAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {meta && (
                <span
                  className="text-[11px] px-2 py-0.5 rounded hidden sm:block"
                  style={{
                    backgroundColor: meta.ai_enabled ? "var(--ai-on-bg)" : "var(--ai-off-bg)",
                    color: meta.ai_enabled ? "var(--ai-on-text)" : "var(--ai-off-text)",
                  }}
                >
                  AI {meta.ai_enabled ? "ON" : "OFF"}
                </span>
              )}
              {/* Details button — tablet */}
              <button
                className="lg:hidden p-1.5 rounded"
                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                onClick={() => setMobileView("details")}
                title="Patient details"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              {/* Export button */}
              <button
                onClick={exportCSV}
                disabled={exportingCSV}
                className="p-1.5 rounded text-[12px] flex items-center gap-1 sm:flex"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
                title="Export as CSV"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {exportingCSV ? "..." : "CSV"}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={threadRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4 relative"
          >
            {loadingMessages ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                    <Skeleton className="h-10 w-48 sm:w-64" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id ?? `msg-${idx}`}
                    msg={msg}
                    showGap={messages[idx - 1]?.direction !== msg.direction}
                  />
                ))}
                {aiTyping && <TypingIndicator />}
              </>
            )}
          </div>

          {/* Scroll to bottom */}
          {!isAtBottom && (
            <div className="absolute bottom-24 right-4 sm:right-8 z-10">
              <button
                onClick={() => scrollToBottom(true)}
                className="text-white text-[12px] px-3 py-1.5 rounded-full"
                style={{ backgroundColor: "var(--accent)", boxShadow: "var(--shadow-lg)" }}
              >
                ↓ New
              </button>
            </div>
          )}

          {/* Manual reply input */}
          <div
            className="px-3 py-3 shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div className="flex gap-2 items-end">
              <textarea
                value={manualMsg}
                onChange={(e) => setManualMsg(e.target.value)}
                onKeyDown={handleManualKeyDown}
                placeholder="Type a message... (Enter to send)"
                rows={2}
                className="flex-1 px-3 py-2 text-[14px] rounded-sm outline-none resize-none"
                style={{
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}
              />
              <button
                onClick={sendManual}
                disabled={sendingManual || !manualMsg.trim()}
                className="px-4 py-2 text-[14px] text-white rounded-sm disabled:opacity-50 shrink-0"
                style={{ backgroundColor: "var(--accent)" }}
              >
                {sendingManual ? "..." : "Send"}
              </button>
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              Staff reply · Enter to send · Shift+Enter for new line
            </p>
          </div>
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center flex-1"
          style={{ color: "var(--text-muted)" }}
        >
          <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="mb-3 opacity-30">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
          </svg>
          <p className="text-[14px]">Select a conversation</p>
        </div>
      )}
    </div>
  );

  // Right panel content
  const RightPanel = (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      {selected ? (
        <>
          {/* Back button — mobile/tablet */}
          <div
            className="lg:hidden flex items-center gap-2 px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <button
              className="flex items-center gap-1 text-[13px]"
              style={{ color: "var(--accent)" }}
              onClick={() => setMobileView("thread")}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to thread
            </button>
          </div>

          {/* Tab switcher */}
          <div className="flex shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
            {(["details", "notes"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 text-[13px] font-medium transition-colors"
                style={{
                  borderBottom: activeTab === tab ? `2px solid var(--accent)` : "2px solid transparent",
                  color: activeTab === tab ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {tab === "details" ? "Details" : "Notes & Tags"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === "details" ? (
              <div className="p-4 space-y-4">
                <p
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Patient Details
                </p>

                {/* Phone */}
                <div>
                  <p className="text-[11px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>Phone</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[14px]"
                      style={{ color: "var(--text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {selected.phone}
                    </span>
                    <button onClick={copyPhone} style={{ color: "var(--text-muted)" }}>
                      {copied
                        ? <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                        : <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { val: selected.totalMessages, label: "messages" },
                    { val: selected.unreadCount ?? 0, label: "unread" },
                  ].map(({ val, label }) => (
                    <div
                      key={label}
                      className="rounded p-2"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <p className="text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>{val}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Dates */}
                {[
                  { label: "First contact", val: formatFullDate(selected.firstContactAt) },
                  { label: "Last active", val: timeAgo(selected.lastMessageAt) },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-[11px] uppercase mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                    <p
                      className="text-[13px]"
                      style={{ color: "var(--text-primary)", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {val}
                    </p>
                  </div>
                ))}

                {/* Intents */}
                {uniqueIntents.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>Intents seen</p>
                    <div className="flex flex-wrap gap-1">
                      {uniqueIntents.map((intent) => (
                        <span
                          key={intent}
                          className="text-[11px] px-2 py-0.5 rounded"
                          style={{ border: `1px solid ${INTENT_COLOURS[intent]}`, color: INTENT_COLOURS[intent] }}
                        >
                          {INTENT_LABELS[intent]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI toggle */}
                {meta && (
                  <div
                    className="flex items-center justify-between py-3"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>AI Auto-reply</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {meta.ai_enabled ? "AI responds automatically" : "Staff handles manually"}
                      </p>
                    </div>
                    <button
                      onClick={toggleAI}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0"
                      style={{ backgroundColor: meta.ai_enabled ? "var(--accent)" : "var(--border)" }}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200"
                        style={{ transform: meta.ai_enabled ? "translateX(24px)" : "translateX(4px)" }}
                      />
                    </button>
                  </div>
                )}

                {/* Actions */}
                <div
                  className="space-y-2 pt-2"
                  style={{ borderTop: "1px solid var(--border)" }}
                >
                  <button
                    onClick={sendBooking}
                    disabled={sendingBooking}
                    className="w-full text-white text-[13px] py-2 rounded-sm disabled:opacity-60 transition-colors"
                    style={{ backgroundColor: "var(--accent)" }}
                  >
                    {sendingBooking ? "Sending..." : "Send booking link"}
                  </button>
                  <button
                    onClick={exportCSV}
                    disabled={exportingCSV}
                    className="w-full text-[13px] py-2 rounded-sm disabled:opacity-60 transition-colors"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--bg-secondary)",
                    }}
                  >
                    {exportingCSV ? "Exporting..." : "Export as CSV"}
                  </button>
                </div>
              </div>
            ) : (
              /* Notes & Tags */
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[11px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>Staff notes</p>
                  <textarea
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Add internal notes..."
                    rows={5}
                    className="w-full px-3 py-2 text-[13px] rounded-sm outline-none resize-none"
                    style={{
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--bg-secondary)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="mt-2 w-full text-[13px] py-1.5 rounded-sm disabled:opacity-50 transition-colors"
                    style={{
                      border: "1px solid var(--accent)",
                      color: "var(--accent)",
                      backgroundColor: "transparent",
                    }}
                  >
                    {savingNotes ? "Saving..." : "Save notes"}
                  </button>
                </div>

                <div>
                  <p className="text-[11px] uppercase mb-2" style={{ color: "var(--text-muted)" }}>Tags</p>
                  {meta && meta.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {meta.tags.map((tag) => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 text-[12px] px-2 py-0.5 rounded"
                          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                        >
                          {tag}
                          <button onClick={() => removeTag(tag)} style={{ color: "var(--text-muted)" }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {AVAILABLE_TAGS.filter((t) => !meta?.tags.includes(t)).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => addTag(tag)}
                        className="text-[11px] px-2 py-0.5 rounded transition-colors"
                        style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && newTag.trim() && addTag(newTag.trim())}
                      placeholder="Custom tag..."
                      className="flex-1 px-2 py-1 text-[12px] rounded outline-none"
                      style={{
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--bg-secondary)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <button
                      onClick={() => newTag.trim() && addTag(newTag.trim())}
                      className="text-[12px] px-2 py-1 text-white rounded"
                      style={{ backgroundColor: "var(--accent)" }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-[14px] text-center" style={{ color: "var(--text-muted)" }}>
            Select a patient to view details
          </p>
        </div>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)", fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-3 sm:px-6 py-2 shrink-0"
        style={{
          borderBottom: "1px solid var(--border)",
          backgroundColor: "var(--bg-primary)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[14px] sm:text-[15px] font-bold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            Bright Smile Dental
          </span>
          <span
            className="text-[12px] hidden sm:block"
            style={{ color: "var(--text-secondary)" }}
          >
            — Dashboard
          </span>
        </div>

        {/* Stats — hide some on small screens */}
        <div className="flex items-center gap-3 sm:gap-5">
          {stats ? (
            <>
              <StatPill label="Today" value={stats.totalPatientsToday} colour="var(--accent)" />
              <StatPill label="Msgs" value={stats.totalMessagesToday} colour="var(--success)" />
              <StatPill
                label="Unread"
                value={totalUnread}
                colour={totalUnread > 0 ? "var(--danger)" : "var(--text-muted)"}
              />
              <span
                className="text-[11px] hidden lg:block"
                style={{ color: "var(--text-muted)" }}
              >
                Top: <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {INTENT_LABEL_MAP[stats.topIntent] ?? stats.topIntent}
                </span>
              </span>
            </>
          ) : (
            <Skeleton className="h-4 w-24 sm:w-40" />
          )}

          {/* Notification button */}
          {notifPermission !== "granted" && (
            <button
              onClick={requestNotifPermission}
              className="text-[11px] px-2 py-1 rounded hidden sm:block"
              style={{
                border: "1px solid var(--accent)",
                color: "var(--accent)",
              }}
            >
              🔔
            </button>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded transition-colors"
            style={{
              backgroundColor: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
            title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          >
            {theme === "light" ? (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────── */}

      {/* DESKTOP: three columns */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <aside
          className="shrink-0"
          style={{ width: 300, borderRight: "1px solid var(--border)" }}
        >
          {LeftPanel}
        </aside>
        <main className="flex-1 min-w-0 relative" style={{ borderRight: "1px solid var(--border)" }}>
          {MiddlePanel}
        </main>
        <aside
          className="shrink-0 overflow-hidden"
          style={{ width: 288, borderLeft: "1px solid var(--border)" }}
        >
          {RightPanel}
        </aside>
      </div>

      {/* TABLET (md–lg): two columns + slide-over details */}
      <div className="hidden md:flex lg:hidden flex-1 overflow-hidden relative">
        {mobileView !== "details" ? (
          <>
            <aside
              className="shrink-0"
              style={{ width: 260, borderRight: "1px solid var(--border)" }}
            >
              {LeftPanel}
            </aside>
            <main className="flex-1 min-w-0 relative">
              {MiddlePanel}
            </main>
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            {RightPanel}
          </div>
        )}
      </div>

      {/* MOBILE (<md): single column with bottom nav */}
      <div className="flex md:hidden flex-1 overflow-hidden flex-col">
        <div className="flex-1 overflow-hidden">
          {mobileView === "list" && LeftPanel}
          {mobileView === "thread" && MiddlePanel}
          {mobileView === "details" && RightPanel}
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="shrink-0 flex"
          style={{
            borderTop: "1px solid var(--border)",
            backgroundColor: "var(--bg-primary)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {([
            {
              view: "list" as MobileView,
              label: "Chats",
              badge: totalUnread,
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              ),
            },
            {
              view: "thread" as MobileView,
              label: "Thread",
              badge: 0,
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              ),
            },
            {
              view: "details" as MobileView,
              label: "Details",
              badge: 0,
              icon: (
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                </svg>
              ),
            },
          ]).map(({ view, label, badge, icon }) => (
            <button
              key={view}
              className="mobile-nav-item flex-1 relative"
              onClick={() => setMobileView(view)}
              style={{
                color: mobileView === view ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <span className="relative">
                {icon}
                {badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1 text-[9px] text-white rounded-full w-4 h-4 flex items-center justify-center font-bold"
                    style={{ backgroundColor: "var(--unread-bg)" }}
                  >
                    {badge}
                  </span>
                )}
              </span>
              {label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
