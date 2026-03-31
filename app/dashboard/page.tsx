/**
 * app/dashboard/page.tsx
 * Smart real-time dashboard — appends new messages only, never full re-renders
 */

"use client";

import {
    useEffect,
    useState,
    useCallback,
    useRef,
    type KeyboardEvent,
} from "react";
import { INTENT_COLOURS, INTENT_LABELS, type Intent } from "@/lib/intents";
import type { PatientSummary } from "@/app/api/patients/route";
import type { MessageRow, PatientMeta } from "@/lib/supabase";
import type { DashboardStats } from "@/app/api/stats/route";

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
        day: "numeric",
        month: "short",
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
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    return isToday
        ? time
        : `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} ${time}`;
}

function formatFullDate(iso: string): string {
    return new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

function Skeleton({ className }: { className: string }) {
    return (
        <div className={`animate-pulse rounded bg-[#E5E7EB] ${className}`} />
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
    } catch {
        // Audio not supported
    }
}

const AVAILABLE_TAGS = [
    "Follow up needed",
    "Booked",
    "VIP",
    "Price-sensitive",
    "New patient",
    "Emergency",
];

// ── Stat pill ─────────────────────────────────────────────────

function StatPill({
    label,
    value,
    colour,
}: {
    label: string;
    value: number;
    colour: string;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <span
                className="text-[20px] font-bold"
                style={{ color: colour, fontFamily: "'IBM Plex Mono', monospace" }}
            >
                {value}
            </span>
            <span className="text-[12px] text-[#6B7280]">{label}</span>
        </div>
    );
}

// ── Single message bubble (memoised so it never re-renders) ───

import { memo } from "react";

const MessageBubble = memo(function MessageBubble({
    msg,
    showGap,
}: {
    msg: MessageRow;
    showGap: boolean;
}) {
    const isOutbound = msg.direction === "outbound";
    return (
        <div
            className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
            style={{ marginTop: showGap ? 16 : 4 }}
        >
            <div
                className="max-w-[70%] text-[14px] leading-relaxed"
                style={{
                    backgroundColor: isOutbound ? "#2563EB" : "#F3F4F6",
                    color: isOutbound ? "#FFFFFF" : "#111827",
                    borderRadius: 4,
                    padding: "8px 12px",
                    wordBreak: "break-word",
                }}
            >
                {msg.content}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
                <span
                    className="text-[11px] text-[#9CA3AF]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                    {formatTime(msg.created_at ?? "")}
                </span>
                {isOutbound && (
                    <span className="text-[10px] text-[#9CA3AF]">
                        · {msg.is_ai ? "AI" : "Staff"}
                    </span>
                )}
            </div>
        </div>
    );
});

// ── Conversation row (memoised) ───────────────────────────────

const ConversationRow = memo(function ConversationRow({
    patient,
    isSelected,
    onClick,
}: {
    patient: PatientSummary;
    isSelected: boolean;
    onClick: () => void;
}) {
    const colour =
        INTENT_COLOURS[patient.lastIntent as Intent] ?? "#9CA3AF";
    const hasUnread = (patient.unreadCount ?? 0) > 0;

    return (
        <button
            onClick={onClick}
            className="w-full text-left px-4 py-3 border-b border-[#E5E7EB] transition-colors duration-150"
            style={{
                backgroundColor: isSelected ? "#EFF6FF" : undefined,
                borderLeft: isSelected
                    ? "3px solid #2563EB"
                    : "3px solid transparent",
            }}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className="shrink-0 rounded-full"
                        style={{ width: 8, height: 8, backgroundColor: colour }}
                    />
                    <span
                        className={`text-[14px] truncate ${hasUnread
                                ? "font-bold text-[#111827]"
                                : "text-[#374151]"
                            }`}
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        {patient.phone}
                    </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {hasUnread && (
                        <span className="text-[11px] text-white bg-[#DC2626] rounded-full px-1.5 py-0.5 font-bold">
                            {patient.unreadCount}
                        </span>
                    )}
                    <span
                        className="text-[12px] text-[#9CA3AF]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        {timeAgo(patient.lastMessageAt)}
                    </span>
                </div>
            </div>
            <p
                className={`text-[13px] truncate mt-0.5 pl-4 ${hasUnread ? "text-[#111827]" : "text-[#6B7280]"
                    }`}
            >
                {patient.lastMessage}
            </p>
        </button>
    );
});

// ── Main Dashboard ────────────────────────────────────────────

export default function DashboardPage() {
    const [patients, setPatients] = useState<PatientSummary[]>([]);
    const [selected, setSelected] = useState<PatientSummary | null>(null);
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [meta, setMeta] = useState<PatientMeta | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [search, setSearch] = useState("");
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
    const [notifPermission, setNotifPermission] =
        useState<NotificationPermission>("default");
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Refs — used inside intervals without causing re-renders
    const selectedRef = useRef<PatientSummary | null>(null);
    const messagesRef = useRef<MessageRow[]>([]);
    const patientsRef = useRef<PatientSummary[]>([]);
    const threadRef = useRef<HTMLDivElement>(null);
    const initialLoadDone = useRef(false);

    selectedRef.current = selected;
    messagesRef.current = messages;
    patientsRef.current = patients;

    // ── Notification permission ───────────────────────────────
    useEffect(() => {
        if ("Notification" in window) {
            setNotifPermission(Notification.permission);
        }
    }, []);

    async function requestNotifPermission() {
        if ("Notification" in window) {
            const p = await Notification.requestPermission();
            setNotifPermission(p);
        }
    }

    // ── Scroll helpers ────────────────────────────────────────
    function scrollToBottom(smooth = true) {
        const el = threadRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    }

    function handleScroll() {
        const el = threadRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        setIsAtBottom(atBottom);
    }

    // ── SMART patient polling — only patches what changed ─────
    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch("/api/patients");
            if (!res.ok) return;
            const fresh: PatientSummary[] = await res.json();
            const current = patientsRef.current;

            // Build lookup map of current patients
            const currentMap = new Map(current.map((p) => [p.phone, p]));

            let hasChanges = false;

            // Detect new messages / new patients and fire notifications
            for (const p of fresh) {
                const prev = currentMap.get(p.phone);
                const isCurrentlySelected =
                    selectedRef.current?.phone === p.phone;

                if (
                    prev &&
                    p.totalMessages > prev.totalMessages &&
                    !isCurrentlySelected
                ) {
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
                ) {
                    hasChanges = true;
                }
            }

            if (fresh.length !== current.length) hasChanges = true;

            // Only call setPatients if something actually changed
            if (hasChanges) {
                setPatients(fresh);

                // Keep selected summary in sync without losing selection
                if (selectedRef.current) {
                    const updated = fresh.find(
                        (p) => p.phone === selectedRef.current!.phone
                    );
                    if (updated) {
                        setSelected((prev) =>
                            prev
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

    // ── SMART message polling — only appends new messages ─────
    const fetchNewMessages = useCallback(async () => {
        const phone = selectedRef.current?.phone;
        if (!phone) return;

        const current = messagesRef.current;
        const lastMsg = current[current.length - 1];

        // Build URL — if we have messages, only fetch newer ones
        const url = lastMsg?.created_at
            ? `/api/messages/${encodeURIComponent(phone)}?after=${encodeURIComponent(lastMsg.created_at)}`
            : `/api/messages/${encodeURIComponent(phone)}`;

        const res = await fetch(url).catch(() => null);
        if (!res?.ok) return;

        const incoming: MessageRow[] = await res.json();

        // Filter to truly new messages (after last known timestamp)
        const newOnes = lastMsg
            ? incoming.filter(
                (m) =>
                    m.id !== lastMsg.id &&
                    new Date(m.created_at ?? 0) > new Date(lastMsg.created_at ?? 0)
            )
            : incoming;

        if (newOnes.length === 0) return;

        // Append only — no full replacement
        setMessages((prev) => {
            // Deduplicate by id
            const existingIds = new Set(prev.map((m) => m.id));
            const toAdd = newOnes.filter((m) => !existingIds.has(m.id));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });

        // Auto-scroll only if user is already at bottom
        if (isAtBottom) {
            setTimeout(() => scrollToBottom(true), 50);
        }
    }, [isAtBottom]);

    // ── Initial message load for selected patient ─────────────
    const loadAllMessages = useCallback(async (phone: string) => {
        setLoadingMessages(true);
        setMessages([]);
        try {
            const res = await fetch(
                `/api/messages/${encodeURIComponent(phone)}`
            );
            if (res.ok) {
                const data: MessageRow[] = await res.json();
                setMessages(data);
                // Scroll to bottom instantly on first load
                setTimeout(() => scrollToBottom(false), 50);
            }
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    // ── Fetch stats ───────────────────────────────────────────
    const fetchStats = useCallback(async () => {
        const res = await fetch("/api/stats").catch(() => null);
        if (res?.ok) setStats(await res.json());
    }, []);

    // ── Fetch meta ────────────────────────────────────────────
    const fetchMeta = useCallback(async (phone: string) => {
        const res = await fetch(
            `/api/patient-meta/${encodeURIComponent(phone)}`
        ).catch(() => null);
        if (res?.ok) {
            const data: PatientMeta = await res.json();
            setMeta(data);
            setNotesInput(data.notes ?? "");
        }
    }, []);

    // ── Polling intervals ─────────────────────────────────────
    useEffect(() => {
        fetchPatients();
        fetchStats();

        // Patient list: poll every 4 seconds
        const pInterval = setInterval(fetchPatients, 4000);
        // Stats: poll every 30 seconds
        const sInterval = setInterval(fetchStats, 30000);

        return () => {
            clearInterval(pInterval);
            clearInterval(sInterval);
        };
    }, [fetchPatients, fetchStats]);

    // Message polling — only when a patient is selected
    useEffect(() => {
        if (!selected) return;

        // Poll for new messages every 3 seconds
        const mInterval = setInterval(fetchNewMessages, 3000);
        return () => clearInterval(mInterval);
    }, [selected, fetchNewMessages]);

    // ── Select patient ────────────────────────────────────────
    async function selectPatient(patient: PatientSummary) {
        setSelected(patient);
        setMeta(null);
        setNotesInput("");
        setActiveTab("details");
        setIsAtBottom(true);

        loadAllMessages(patient.phone);
        fetchMeta(patient.phone);

        // Mark as read
        await fetch("/api/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: patient.phone }),
        });

        setPatients((prev) =>
            prev.map((p) =>
                p.phone === patient.phone ? { ...p, unreadCount: 0 } : p
            )
        );
    }

    // ── Send manual message ───────────────────────────────────
    async function sendManual() {
        if (!selected || !manualMsg.trim()) return;
        setSendingManual(true);

        // Optimistic update — show message immediately
        const optimistic: MessageRow = {
            id: `optimistic-${Date.now()}`,
            patient_phone: selected.phone,
            direction: "outbound",
            content: manualMsg.trim(),
            intent: "general",
            is_ai: false,
            is_read: true,
            created_at: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, optimistic]);
        setManualMsg("");
        setTimeout(() => scrollToBottom(true), 50);

        try {
            await fetch("/api/send-manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: selected.phone,
                    message: optimistic.content,
                }),
            });
        } finally {
            setSendingManual(false);
        }
    }

    function handleManualKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendManual();
        }
    }

    // ── Send booking link ─────────────────────────────────────
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

    // ── Toggle AI ─────────────────────────────────────────────
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

    // ── Save notes ────────────────────────────────────────────
    async function saveNotes() {
        if (!selected) return;
        setSavingNotes(true);
        await fetch(`/api/patient-meta/${encodeURIComponent(selected.phone)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: notesInput }),
        });
        setMeta((m) => (m ? { ...m, notes: notesInput } : m));
        setSavingNotes(false);
    }

    // ── Tags ──────────────────────────────────────────────────
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

    // ── Copy phone ────────────────────────────────────────────
    function copyPhone() {
        if (!selected) return;
        navigator.clipboard.writeText(selected.phone);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // ── Derived values ────────────────────────────────────────
    const filtered = patients.filter((p) =>
        p.phone.toLowerCase().includes(search.toLowerCase())
    );

    const uniqueIntents: Intent[] = selected
        ? ([
            ...new Set(
                messages
                    .map((m) => m.intent as Intent)
                    .filter(Boolean)
            ),
        ] as Intent[])
        : [];

    const totalUnread = patients.reduce(
        (sum, p) => sum + (p.unreadCount ?? 0),
        0
    );

    const INTENT_LABEL_MAP: Record<string, string> = {
        booking_request: "Booking",
        pricing_query: "Pricing",
        treatment_question: "Treatment",
        emergency: "Emergency",
        post_treatment_care: "Aftercare",
        hours_location: "Hours/Location",
        insurance_payment: "Insurance",
        general: "General",
    };

    // ── Render ────────────────────────────────────────────────
    return (
        <>
            {/* Mobile fallback */}
            <div className="flex lg:hidden items-center justify-center h-screen bg-white">
                <p className="text-[#6B7280] text-[14px] text-center px-8">
                    Dashboard is optimised for desktop. Please use a screen wider
                    than 1024px.
                </p>
            </div>

            <div
                className="hidden lg:flex flex-col h-screen overflow-hidden bg-white"
                style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
                {/* ── Stats header ──────────────────────────────────── */}
                <header className="flex items-center justify-between px-6 py-2 border-b border-[#E5E7EB] bg-white shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[15px] font-bold text-[#111827]">
                            Bright Smile Dental
                        </span>
                        <span className="text-[12px] text-[#6B7280]">
                            — Agent Dashboard
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        {stats ? (
                            <>
                                <StatPill
                                    label="Patients today"
                                    value={stats.totalPatientsToday}
                                    colour="#2563EB"
                                />
                                <StatPill
                                    label="Messages today"
                                    value={stats.totalMessagesToday}
                                    colour="#059669"
                                />
                                <StatPill
                                    label="Bookings sent"
                                    value={stats.bookingsSentToday}
                                    colour="#7C3AED"
                                />
                                <StatPill
                                    label="Unread"
                                    value={totalUnread}
                                    colour={totalUnread > 0 ? "#DC2626" : "#9CA3AF"}
                                />
                                {stats.topIntent !== "—" && (
                                    <span className="text-[12px] text-[#6B7280]">
                                        Top:{" "}
                                        <span className="text-[#111827] font-medium">
                                            {INTENT_LABEL_MAP[stats.topIntent] ??
                                                stats.topIntent}
                                        </span>
                                    </span>
                                )}
                            </>
                        ) : (
                            <Skeleton className="h-4 w-48" />
                        )}
                        {notifPermission !== "granted" && (
                            <button
                                onClick={requestNotifPermission}
                                className="text-[12px] text-[#2563EB] border border-[#2563EB] px-2 py-1 rounded hover:bg-[#EFF6FF] transition-colors"
                            >
                                Enable notifications
                            </button>
                        )}
                    </div>
                </header>

                {/* ── Three-column body ─────────────────────────────── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Left: Conversation list ───────────────────── */}
                    <aside
                        className="flex flex-col border-r border-[#E5E7EB] bg-[#F9FAFB]"
                        style={{ width: 300, minWidth: 300 }}
                    >
                        <div className="px-4 py-3 border-b border-[#E5E7EB]">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-[16px] text-[#111827]">
                                    Conversations
                                </span>
                                <span className="text-[12px] text-white bg-[#2563EB] rounded px-1.5 py-0.5">
                                    {patients.length}
                                </span>
                                {totalUnread > 0 && (
                                    <span className="text-[12px] text-white bg-[#DC2626] rounded-full px-1.5 py-0.5 ml-auto">
                                        {totalUnread}
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                placeholder="Search by phone number..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full border border-[#E5E7EB] rounded-xs px-3 py-1.5 text-[13px] text-[#111827] outline-none focus:border-[#2563EB]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {loadingPatients ? (
                                <div className="p-4 space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i}>
                                            <Skeleton className="h-4 w-36 mb-1" />
                                            <Skeleton className="h-3 w-48" />
                                        </div>
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <p className="text-[14px] text-[#6B7280] text-center mt-8">
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
                    </aside>

                    {/* ── Middle: Thread view ───────────────────────── */}
                    <main className="flex flex-col flex-1 min-w-0 border-r border-[#E5E7EB]">
                        {selected ? (
                            <>
                                {/* Thread header */}
                                <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between shrink-0">
                                    <div>
                                        <p
                                            className="text-[16px] font-bold text-[#111827]"
                                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                        >
                                            {selected.phone}
                                        </p>
                                        <p
                                            className="text-[12px] text-[#6B7280]"
                                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                        >
                                            First contact:{" "}
                                            {new Date(
                                                selected.firstContactAt
                                            ).toLocaleDateString("en-GB", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </p>
                                    </div>
                                    {meta && (
                                        <span
                                            className="text-[12px] px-2 py-1 rounded"
                                            style={{
                                                backgroundColor: meta.ai_enabled
                                                    ? "#DCFCE7"
                                                    : "#FEE2E2",
                                                color: meta.ai_enabled ? "#166534" : "#991B1B",
                                            }}
                                        >
                                            AI {meta.ai_enabled ? "ON" : "OFF"}
                                        </span>
                                    )}
                                </div>

                                {/* Messages — scrollable, never fully re-renders */}
                                <div
                                    ref={threadRef}
                                    onScroll={handleScroll}
                                    className="flex-1 overflow-y-auto px-4 py-4"
                                >
                                    {loadingMessages ? (
                                        <div className="space-y-4">
                                            {[1, 2, 3].map((i) => (
                                                <div
                                                    key={i}
                                                    className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"
                                                        }`}
                                                >
                                                    <Skeleton className="h-10 w-64" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        messages.map((msg, idx) => (
                                            <MessageBubble
                                                key={msg.id ?? `msg-${idx}`}
                                                msg={msg}
                                                showGap={
                                                    messages[idx - 1]?.direction !== msg.direction
                                                }
                                            />
                                        ))
                                    )}
                                </div>

                                {/* Scroll-to-bottom button */}
                                {!isAtBottom && (
                                    <div className="absolute bottom-24 right-8">
                                        <button
                                            onClick={() => scrollToBottom(true)}
                                            className="bg-[#2563EB] text-white text-[12px] px-3 py-1.5 rounded-full shadow-md hover:bg-[#1D4ED8] transition-colors"
                                        >
                                            ↓ New messages
                                        </button>
                                    </div>
                                )}

                                {/* Manual reply input */}
                                <div className="border-t border-[#E5E7EB] px-4 py-3 shrink-0">
                                    <div className="flex gap-2 items-end">
                                        <textarea
                                            value={manualMsg}
                                            onChange={(e) => setManualMsg(e.target.value)}
                                            onKeyDown={handleManualKeyDown}
                                            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                                            rows={2}
                                            className="flex-1 border border-[#E5E7EB] rounded-sm px-3 py-2 text-[14px] text-[#111827] outline-none focus:border-[#2563EB] resize-none"
                                        />
                                        <button
                                            onClick={sendManual}
                                            disabled={sendingManual || !manualMsg.trim()}
                                            className="px-4 py-2 text-[14px] text-white rounded-sm disabled:opacity-50 transition-colors shrink-0"
                                            style={{ backgroundColor: "#2563EB" }}
                                        >
                                            {sendingManual ? "..." : "Send"}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-[#9CA3AF] mt-1">
                                        Staff reply — sends directly via WhatsApp
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center flex-1 text-[#6B7280]">
                                <svg
                                    width="32"
                                    height="32"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    viewBox="0 0 24 24"
                                    className="mb-3 opacity-40"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                                    />
                                </svg>
                                <p className="text-[14px]">Select a conversation</p>
                            </div>
                        )}
                    </main>

                    {/* ── Right: Patient details ────────────────────── */}
                    <aside
                        className="flex flex-col border-l border-[#E5E7EB] overflow-y-auto"
                        style={{ width: 300, minWidth: 300 }}
                    >
                        {selected ? (
                            <div className="flex flex-col h-full">
                                {/* Tab switcher */}
                                <div className="flex border-b border-[#E5E7EB] shrink-0">
                                    {(["details", "notes"] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab)}
                                            className="flex-1 py-2 text-[13px] font-medium transition-colors"
                                            style={{
                                                borderBottom:
                                                    activeTab === tab
                                                        ? "2px solid #2563EB"
                                                        : "2px solid transparent",
                                                color:
                                                    activeTab === tab ? "#2563EB" : "#6B7280",
                                            }}
                                        >
                                            {tab === "details" ? "Details" : "Notes & Tags"}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === "details" ? (
                                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                                        <p className="text-[13px] font-bold text-[#111827] uppercase tracking-widest">
                                            Patient Details
                                        </p>

                                        {/* Phone */}
                                        <div>
                                            <p className="text-[11px] text-[#6B7280] uppercase mb-1">
                                                Phone
                                            </p>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-[15px] text-[#111827]"
                                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                                >
                                                    {selected.phone}
                                                </span>
                                                <button
                                                    onClick={copyPhone}
                                                    className="text-[#9CA3AF] hover:text-[#2563EB] transition-colors"
                                                >
                                                    {copied ? (
                                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                                        </svg>
                                                    ) : (
                                                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                        </svg>
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Stats */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="border border-[#E5E7EB] rounded p-2">
                                                <p className="text-[20px] font-bold text-[#111827]">
                                                    {selected.totalMessages}
                                                </p>
                                                <p className="text-[11px] text-[#6B7280]">messages</p>
                                            </div>
                                            <div className="border border-[#E5E7EB] rounded p-2">
                                                <p className="text-[20px] font-bold text-[#111827]">
                                                    {selected.unreadCount ?? 0}
                                                </p>
                                                <p className="text-[11px] text-[#6B7280]">unread</p>
                                            </div>
                                        </div>

                                        {/* Dates */}
                                        <div>
                                            <p className="text-[11px] text-[#6B7280] uppercase mb-1">
                                                First contact
                                            </p>
                                            <p
                                                className="text-[13px] text-[#111827]"
                                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                            >
                                                {formatFullDate(selected.firstContactAt)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] text-[#6B7280] uppercase mb-1">
                                                Last active
                                            </p>
                                            <p
                                                className="text-[13px] text-[#111827]"
                                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                            >
                                                {timeAgo(selected.lastMessageAt)}
                                            </p>
                                        </div>

                                        {/* Intents */}
                                        {uniqueIntents.length > 0 && (
                                            <div>
                                                <p className="text-[11px] text-[#6B7280] uppercase mb-2">
                                                    Intents seen
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {uniqueIntents.map((intent) => (
                                                        <span
                                                            key={intent}
                                                            className="text-[11px] px-2 py-0.5 rounded"
                                                            style={{
                                                                border: `1px solid ${INTENT_COLOURS[intent]}`,
                                                                color: INTENT_COLOURS[intent],
                                                            }}
                                                        >
                                                            {INTENT_LABELS[intent]}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* AI toggle */}
                                        {meta && (
                                            <div className="flex items-center justify-between py-2 border-t border-[#E5E7EB]">
                                                <div>
                                                    <p className="text-[13px] font-medium text-[#111827]">
                                                        AI Auto-reply
                                                    </p>
                                                    <p className="text-[11px] text-[#6B7280]">
                                                        {meta.ai_enabled
                                                            ? "AI responds automatically"
                                                            : "Staff handles manually"}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={toggleAI}
                                                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0"
                                                    style={{
                                                        backgroundColor: meta.ai_enabled
                                                            ? "#2563EB"
                                                            : "#D1D5DB",
                                                    }}
                                                >
                                                    <span
                                                        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200"
                                                        style={{
                                                            transform: meta.ai_enabled
                                                                ? "translateX(24px)"
                                                                : "translateX(4px)",
                                                        }}
                                                    />
                                                </button>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="space-y-2 pt-2 border-t border-[#E5E7EB]">
                                            <button
                                                onClick={sendBooking}
                                                disabled={sendingBooking}
                                                className="w-full text-white text-[13px] py-2 rounded-sm transition-colors disabled:opacity-60"
                                                style={{ backgroundColor: "#2563EB" }}
                                            >
                                                {sendingBooking ? "Sending..." : "Send booking link"}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                                        {/* Notes */}
                                        <div>
                                            <p className="text-[11px] text-[#6B7280] uppercase mb-2">
                                                Staff notes
                                            </p>
                                            <textarea
                                                value={notesInput}
                                                onChange={(e) => setNotesInput(e.target.value)}
                                                placeholder="Add internal notes about this patient..."
                                                rows={5}
                                                className="w-full border border-[#E5E7EB] rounded-sm px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-[#2563EB] resize-none"
                                            />
                                            <button
                                                onClick={saveNotes}
                                                disabled={savingNotes}
                                                className="mt-2 w-full border border-[#2563EB] text-[#2563EB] text-[13px] py-1.5 rounded-sm hover:bg-[#EFF6FF] transition-colors disabled:opacity-50"
                                            >
                                                {savingNotes ? "Saving..." : "Save notes"}
                                            </button>
                                        </div>

                                        {/* Tags */}
                                        <div>
                                            <p className="text-[11px] text-[#6B7280] uppercase mb-2">
                                                Tags
                                            </p>
                                            {meta && meta.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-3">
                                                    {meta.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="flex items-center gap-1 text-[12px] px-2 py-0.5 bg-[#F3F4F6] text-[#374151] rounded"
                                                        >
                                                            {tag}
                                                            <button
                                                                onClick={() => removeTag(tag)}
                                                                className="text-[#9CA3AF] hover:text-[#DC2626]"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {AVAILABLE_TAGS.filter(
                                                    (t) => !meta?.tags.includes(t)
                                                ).map((tag) => (
                                                    <button
                                                        key={tag}
                                                        onClick={() => addTag(tag)}
                                                        className="text-[11px] px-2 py-0.5 border border-[#E5E7EB] text-[#6B7280] rounded hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
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
                                                    onKeyDown={(e) =>
                                                        e.key === "Enter" &&
                                                        newTag.trim() &&
                                                        addTag(newTag.trim())
                                                    }
                                                    placeholder="Custom tag..."
                                                    className="flex-1 border border-[#E5E7EB] rounded px-2 py-1 text-[12px] outline-none focus:border-[#2563EB]"
                                                />
                                                <button
                                                    onClick={() =>
                                                        newTag.trim() && addTag(newTag.trim())
                                                    }
                                                    className="text-[12px] px-2 py-1 bg-[#2563EB] text-white rounded"
                                                >
                                                    Add
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-1 items-center justify-center p-4">
                                <p className="text-[14px] text-[#6B7280] text-center">
                                    Select a patient to view details
                                </p>
                            </div>
                        )}
                    </aside>
                </div>
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;700&display=swap');
      `}</style>
        </>
    );
}