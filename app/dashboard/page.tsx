/**
 * app/dashboard/page.tsx
 * ─────────────────────────────────────────────────────────────
 * Internal clinic dashboard.
 * Responsive layout:
 *   mobile  (<640px)   : single-panel with back navigation
 *   tablet  (640-1023) : two-column (list + thread), details in slide-up sheet
 *   desktop (≥1024px)  : original three-column layout
 * ─────────────────────────────────────────────────────────────
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { INTENT_COLOURS, INTENT_LABELS, type Intent } from "@/lib/intents";
import type { PatientSummary } from "@/app/api/patients/route";
import type { MessageRow } from "@/lib/supabase";

// ── Utility helpers ───────────────────────────────────────────

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return "Yesterday";
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

    if (isToday) return time;
    return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} ${time}`;
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

// ── Skeleton loader ───────────────────────────────────────────

function Skeleton({ className }: { className: string }) {
    return (
        <div className={`animate-pulse rounded bg-[#E5E7EB] ${className}`} />
    );
}

// ── Patient Details Panel (shared between tablet sheet & desktop sidebar) ──

interface PatientDetailsPanelProps {
    selected: PatientSummary;
    messages: MessageRow[];
    now: number;
    copied: boolean;
    sendingBooking: boolean;
    onCopyPhone: () => void;
    onSendBooking: () => void;
}

function PatientDetailsPanel({
    selected,
    messages,
    now,
    copied,
    sendingBooking,
    onCopyPhone,
    onSendBooking,
}: PatientDetailsPanelProps) {
    const uniqueIntents: Intent[] = [
        ...new Set(
            messages
                .map((m) => m.intent as Intent)
                .filter((i): i is Intent => !!i)
        ),
    ] as Intent[];

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <p className="text-[14px] font-bold text-[#111827] uppercase tracking-widest">
                Patient Details
            </p>

            {/* Phone */}
            <div>
                <p className="text-[12px] text-[#6B7280] mb-1">Phone</p>
                <div className="flex items-center gap-2">
                    <span
                        className="text-[16px] text-[#111827]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        {selected.phone}
                    </span>
                    <button
                        onClick={onCopyPhone}
                        title="Copy phone number"
                        className="text-[#6B7280] hover:text-[#2563EB] transition-colors"
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

            {/* Total messages */}
            <div>
                <p className="text-[24px] font-bold text-[#111827]">
                    {selected.totalMessages}
                </p>
                <p className="text-[12px] text-[#6B7280]">messages</p>
            </div>

            {/* First contact */}
            <div>
                <p className="text-[12px] text-[#6B7280] mb-1">First contact</p>
                <p
                    className="text-[13px] text-[#111827]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                    {formatFullDate(selected.firstContactAt)}
                </p>
            </div>

            {/* Last active */}
            <div>
                <p className="text-[12px] text-[#6B7280] mb-1">Last active</p>
                <p
                    className="text-[13px] text-[#111827]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                    {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
                    {now && timeAgo(selected.lastMessageAt)}
                </p>
            </div>

            {/* Intents seen */}
            {uniqueIntents.length > 0 && (
                <div>
                    <p className="text-[12px] text-[#6B7280] mb-2">Intents seen</p>
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

            {/* Send booking link */}
            <button
                onClick={onSendBooking}
                disabled={sendingBooking}
                className="w-full text-white text-[14px] py-2 rounded transition-colors duration-150 disabled:opacity-60"
                style={{
                    backgroundColor: sendingBooking ? "#1D4ED8" : "#2563EB",
                    borderRadius: 4,
                }}
                onMouseEnter={(e) => {
                    if (!sendingBooking)
                        (e.currentTarget as HTMLElement).style.backgroundColor = "#1D4ED8";
                }}
                onMouseLeave={(e) => {
                    if (!sendingBooking)
                        (e.currentTarget as HTMLElement).style.backgroundColor = "#2563EB";
                }}
            >
                {sendingBooking ? "Sending..." : "Send booking link"}
            </button>
        </div>
    );
}

// ── Thread View (shared across breakpoints) ───────────────────

interface ThreadViewProps {
    selected: PatientSummary;
    messages: MessageRow[];
    loadingMessages: boolean;
    /** Mobile/tablet: show back button */
    onBack?: () => void;
    /** Tablet: show details button */
    onShowDetails?: () => void;
}

function ThreadView({
    selected,
    messages,
    loadingMessages,
    onBack,
    onShowDetails,
}: ThreadViewProps) {
    return (
        <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="text-[#6B7280] hover:text-[#111827] transition-colors mr-1"
                        aria-label="Back to conversations"
                    >
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                )}
                <div className="flex-1 min-w-0">
                    <p
                        className="text-[16px] font-bold text-[#111827] truncate"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        {selected.phone}
                    </p>
                    <p
                        className="text-[12px] text-[#6B7280]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        First contact:{" "}
                        {new Date(selected.firstContactAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                        })}
                    </p>
                </div>
                {onShowDetails && (
                    <button
                        onClick={onShowDetails}
                        className="text-[12px] text-[#2563EB] border border-[#2563EB] rounded px-2 py-1 hover:bg-[#EFF6FF] transition-colors flex-shrink-0"
                    >
                        Details
                    </button>
                )}
            </div>

            {/* Messages */}
            <div
                id="thread-scroll"
                className="flex-1 overflow-y-auto px-4 py-4"
            >
                {loadingMessages ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}
                            >
                                <Skeleton className="h-10 w-64" />
                            </div>
                        ))}
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isOutbound = msg.direction === "outbound";
                        const prevMsg = messages[idx - 1];
                        const sameSender = prevMsg?.direction === msg.direction;

                        return (
                            <div
                                key={msg.id ?? idx}
                                className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                                style={{ marginTop: sameSender ? 4 : 16 }}
                            >
                                <div
                                    className="max-w-[75%] sm:max-w-[70%] text-[14px] leading-relaxed"
                                    style={{
                                        backgroundColor: isOutbound ? "#2563EB" : "#F3F4F6",
                                        color: isOutbound ? "#FFFFFF" : "#111827",
                                        borderRadius: 4,
                                        padding: "8px 12px",
                                    }}
                                >
                                    {msg.content}
                                </div>
                                <span
                                    className="text-[11px] text-[#9CA3AF] mt-0.5"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                >
                                    {formatTime(msg.created_at ?? "")}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </>
    );
}

// ── Conversation List ─────────────────────────────────────────

interface ConversationListProps {
    patients: PatientSummary[];
    filtered: PatientSummary[];
    selected: PatientSummary | null;
    loadingPatients: boolean;
    search: string;
    onSearchChange: (v: string) => void;
    onSelect: (p: PatientSummary) => void;
}

function ConversationList({
    patients,
    filtered,
    selected,
    loadingPatients,
    search,
    onSearchChange,
    onSelect,
}: ConversationListProps) {
    return (
        <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-[16px] text-[#111827]">
                        Conversations
                    </span>
                    <span className="text-[12px] text-white bg-[#2563EB] rounded px-1.5 py-0.5">
                        {patients.length}
                    </span>
                </div>
                <input
                    type="text"
                    placeholder="Search by phone number..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="mt-2 w-full border border-[#E5E7EB] rounded-[2px] px-3 py-1.5 text-[13px] text-[#111827] outline-none focus:border-[#2563EB]"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                />
            </div>

            {/* List */}
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
                    filtered.map((patient) => {
                        const isSelected = selected?.phone === patient.phone;
                        const colour =
                            INTENT_COLOURS[patient.lastIntent as Intent] ?? "#9CA3AF";

                        return (
                            <button
                                key={patient.phone}
                                onClick={() => onSelect(patient)}
                                className="w-full text-left px-4 py-3 border-b border-[#E5E7EB] transition-colors duration-150"
                                style={{
                                    backgroundColor: isSelected ? "#EFF6FF" : undefined,
                                    borderLeft: isSelected
                                        ? "3px solid #2563EB"
                                        : "3px solid transparent",
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected)
                                        (e.currentTarget as HTMLElement).style.backgroundColor =
                                            "#F9FAFB";
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected)
                                        (e.currentTarget as HTMLElement).style.backgroundColor = "";
                                }}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="flex-shrink-0 rounded-full"
                                            style={{
                                                width: 8,
                                                height: 8,
                                                backgroundColor: colour,
                                            }}
                                        />
                                        <span
                                            className="text-[14px] text-[#111827] truncate"
                                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                        >
                                            {patient.phone}
                                        </span>
                                    </div>
                                    <span
                                        className="text-[12px] text-[#9CA3AF] flex-shrink-0"
                                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                    >
                                        {timeAgo(patient.lastMessageAt)}
                                    </span>
                                </div>
                                <p className="text-[13px] text-[#6B7280] truncate mt-0.5 pl-4">
                                    {patient.lastMessage}
                                </p>
                            </button>
                        );
                    })
                )}
            </div>
        </>
    );
}

// ── Main Dashboard ────────────────────────────────────────────

type MobileView = "list" | "thread" | "details";

export default function DashboardPage() {
    const [patients, setPatients] = useState<PatientSummary[]>([]);
    const [selected, setSelected] = useState<PatientSummary | null>(null);
    const [messages, setMessages] = useState<MessageRow[]>([]);
    const [search, setSearch] = useState("");
    const [loadingPatients, setLoadingPatients] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [sendingBooking, setSendingBooking] = useState(false);
    const [copied, setCopied] = useState(false);
    const [now, setNow] = useState(Date.now());

    // Mobile navigation state
    const [mobileView, setMobileView] = useState<MobileView>("list");
    // Tablet details sheet
    const [showDetailsSheet, setShowDetailsSheet] = useState(false);

    // ── Fetch patients ──────────────────────────────────────────
    const fetchPatients = useCallback(async () => {
        try {
            const res = await fetch("/api/patients");
            if (res.ok) {
                const data: PatientSummary[] = await res.json();
                setPatients(data);
            }
        } catch {
            // Silently fail
        } finally {
            setLoadingPatients(false);
        }
    }, []);

    // ── Fetch messages for selected patient ────────────────────
    const fetchMessages = useCallback(async (phone: string) => {
        setLoadingMessages(true);
        try {
            const res = await fetch(`/api/messages/${encodeURIComponent(phone)}`);
            if (res.ok) {
                const data: MessageRow[] = await res.json();
                setMessages(data);
            }
        } catch {
            // Silently fail
        } finally {
            setLoadingMessages(false);
        }
    }, []);

    // ── Initial load + polling ──────────────────────────────────
    useEffect(() => {
        fetchPatients();
        const interval = setInterval(fetchPatients, 5000);
        return () => clearInterval(interval);
    }, [fetchPatients]);

    // ── Poll messages for selected patient ─────────────────────
    useEffect(() => {
        if (!selected) return;
        fetchMessages(selected.phone);
        const interval = setInterval(() => fetchMessages(selected.phone), 5000);
        return () => clearInterval(interval);
    }, [selected, fetchMessages]);

    // ── Tick for relative times ─────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    // ── Auto-scroll thread to bottom ───────────────────────────
    useEffect(() => {
        const el = document.getElementById("thread-scroll");
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    // ── Send booking link ───────────────────────────────────────
    async function sendBooking() {
        if (!selected) return;
        setSendingBooking(true);
        try {
            await fetch("/api/send-booking", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: selected.phone }),
            });
            fetchMessages(selected.phone);
        } finally {
            setSendingBooking(false);
        }
    }

    // ── Copy phone to clipboard ─────────────────────────────────
    function copyPhone() {
        if (!selected) return;
        navigator.clipboard.writeText(selected.phone);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    // ── Filtered patient list ───────────────────────────────────
    const filtered = patients.filter((p) =>
        p.phone.toLowerCase().includes(search.toLowerCase())
    );

    // ── Select patient handler ──────────────────────────────────
    function handleSelectPatient(patient: PatientSummary) {
        setSelected(patient);
        setMobileView("thread");
        setShowDetailsSheet(false);
    }

    return (
        <>
            {/* ── Mobile layout (< 640px) ── */}
            <div
                className="flex sm:hidden flex-col h-screen overflow-hidden bg-white"
                style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
                {mobileView === "list" && (
                    <div className="flex flex-col h-full bg-[#F9FAFB]">
                        <ConversationList
                            patients={patients}
                            filtered={filtered}
                            selected={selected}
                            loadingPatients={loadingPatients}
                            search={search}
                            onSearchChange={setSearch}
                            onSelect={handleSelectPatient}
                        />
                    </div>
                )}

                {mobileView === "thread" && selected && (
                    <div className="flex flex-col h-full">
                        <ThreadView
                            selected={selected}
                            messages={messages}
                            loadingMessages={loadingMessages}
                            onBack={() => setMobileView("list")}
                            onShowDetails={() => setMobileView("details")}
                        />
                    </div>
                )}

                {mobileView === "details" && selected && (
                    <div className="flex flex-col h-full overflow-y-auto">
                        {/* Back to thread */}
                        <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center gap-2">
                            <button
                                onClick={() => setMobileView("thread")}
                                className="text-[#6B7280] hover:text-[#111827] transition-colors"
                                aria-label="Back to thread"
                            >
                                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                            <span className="text-[14px] font-semibold text-[#111827]">Patient Details</span>
                        </div>
                        <PatientDetailsPanel
                            selected={selected}
                            messages={messages}
                            now={now}
                            copied={copied}
                            sendingBooking={sendingBooking}
                            onCopyPhone={copyPhone}
                            onSendBooking={sendBooking}
                        />
                    </div>
                )}
            </div>

            {/* ── Tablet layout (640px–1023px) ── */}
            <div
                className="hidden sm:flex lg:hidden h-screen overflow-hidden bg-white"
                style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
                {/* Left: conversation list */}
                <aside
                    className="flex flex-col border-r border-[#E5E7EB] bg-[#F9FAFB]"
                    style={{ width: 280, minWidth: 200, flexShrink: 0 }}
                >
                    <ConversationList
                        patients={patients}
                        filtered={filtered}
                        selected={selected}
                        loadingPatients={loadingPatients}
                        search={search}
                        onSearchChange={setSearch}
                        onSelect={(p) => {
                            setSelected(p);
                            setShowDetailsSheet(false);
                        }}
                    />
                </aside>

                {/* Right: thread */}
                <main className="flex flex-col flex-1 min-w-0 relative">
                    {selected ? (
                        <ThreadView
                            selected={selected}
                            messages={messages}
                            loadingMessages={loadingMessages}
                            onShowDetails={() => setShowDetailsSheet((v) => !v)}
                        />
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

                    {/* Slide-up details sheet for tablet */}
                    {showDetailsSheet && selected && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/20 z-10"
                                onClick={() => setShowDetailsSheet(false)}
                            />
                            {/* Sheet */}
                            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] rounded-t-xl z-20 max-h-[70%] overflow-y-auto shadow-xl">
                                <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
                                    <span className="text-[13px] font-semibold text-[#111827]">Patient Details</span>
                                    <button
                                        onClick={() => setShowDetailsSheet(false)}
                                        className="text-[#6B7280] hover:text-[#111827] transition-colors"
                                    >
                                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <PatientDetailsPanel
                                    selected={selected}
                                    messages={messages}
                                    now={now}
                                    copied={copied}
                                    sendingBooking={sendingBooking}
                                    onCopyPhone={copyPhone}
                                    onSendBooking={sendBooking}
                                />
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* ── Desktop layout (≥1024px) — original three-column ── */}
            <div
                className="hidden lg:flex h-screen overflow-hidden bg-white"
                style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
                {/* Left column: Conversation list */}
                <aside
                    className="flex flex-col border-r border-[#E5E7EB] bg-[#F9FAFB]"
                    style={{ width: 320, minWidth: 320 }}
                >
                    <ConversationList
                        patients={patients}
                        filtered={filtered}
                        selected={selected}
                        loadingPatients={loadingPatients}
                        search={search}
                        onSearchChange={setSearch}
                        onSelect={setSelected}
                    />
                </aside>

                {/* Middle column: Thread view */}
                <main className="flex flex-col flex-1 min-w-0 border-r border-[#E5E7EB]">
                    {selected ? (
                        <ThreadView
                            selected={selected}
                            messages={messages}
                            loadingMessages={loadingMessages}
                        />
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

                {/* Right column: Patient details */}
                <aside
                    className="flex flex-col border-l border-[#E5E7EB]"
                    style={{ width: 300, minWidth: 300 }}
                >
                    {selected ? (
                        <PatientDetailsPanel
                            selected={selected}
                            messages={messages}
                            now={now}
                            copied={copied}
                            sendingBooking={sendingBooking}
                            onCopyPhone={copyPhone}
                            onSendBooking={sendBooking}
                        />
                    ) : (
                        <div className="flex flex-1 items-center justify-center p-4">
                            <p className="text-[14px] text-[#6B7280] text-center">
                                Select a patient to view details
                            </p>
                        </div>
                    )}
                </aside>
            </div>

            {/* Google Fonts */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;700&display=swap');
      `}</style>
        </>
    );
}