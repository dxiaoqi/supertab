"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { localPredict } from "@/lib/cybertext";
import { getPreferenceSuggestion, recordAccept } from "@/lib/user-prefs";
import { useChat } from "@ai-sdk/react";

type UIPart = { type: "text"; text: string };
type UIMessage = { id: string; role: "user" | "assistant"; parts?: UIPart[] };
export default function Home() {
  const { messages, status } = useChat();
  const [input, setInput] = useState("");
  const [ghost, setGhost] = useState("");
  const [chipVisible, setChipVisible] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Tab Cybertext</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>尝试与AI对话，并通过tab键接收AI的信号</p>

      <div style={{ position: "relative", marginBottom: 12, width: 680 }}>
        <textarea
          ref={textAreaRef}
          value={input}
          placeholder="开始输入...（按 Tab 确认建议）"
          onChange={(e) => setInput(e.target.value)}
          onScroll={(e) => {
            if (ghostRef.current) {
              ghostRef.current.scrollTop = e.currentTarget.scrollTop;
              ghostRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Tab" && ghost) {
              e.preventDefault();
              setInput((prev) => {
                recordAccept(prev, ghost);
                return prev + ghost;
              });
              setGhost("");
              setChipVisible(false);
            }
          }}
          disabled={status !== "ready"}
          style={{
            width: 680,
            height: 180,
            padding: "12px 14px",
            borderRadius: 10,
            border: "none",
            outline: "none",
            resize: "none",
            overflow: "auto",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
            fontSize: 14,
            background: "#fff",
          }}
        />
        <div
          ref={ghostRef}
          aria-hidden
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: 0,
            left: 0,
            width: 680,
            height: 180,
            padding: "12px 14px",
            color: "#9aa0a6",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
            fontSize: 14,
            whiteSpace: "pre-wrap",
            overflow: "hidden",
            opacity: 0.8,
          }}
        >
          <span style={{ visibility: "hidden" }}>{input}</span>
          <span>
            {ghost}
            {ghost && chipVisible ? " " : ""}
            {ghost && chipVisible ? <span className="tab-chip">TAB</span> : null}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 24, borderTop: "1px solid #eee", paddingTop: 12 }}>
        {(messages as UIMessage[]).map((m) => (
          <div key={m.id} style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>
            <strong>{m.role === "user" ? "You" : "AI"}: </strong>
            {m.parts?.map((part, idx) => (
              <span key={idx}>{part.type === "text" ? part.text : ""}</span>
            ))}
          </div>
        ))}
      </div>

      <Predictor input={input} setGhost={setGhost} setChipVisible={setChipVisible} />
    </main>
  );
}

function Predictor({ input, setGhost, setChipVisible }: { input: string; setGhost: (s: string) => void; setChipVisible: (v: boolean) => void }) {
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [lastReqAt, setLastReqAt] = useState<number>(0);

  const request = useCallback(async (query: string) => {
    const cached = cacheRef.current.get(query);
    if (cached !== undefined) {
      setGhost(cached);
      setChipVisible(!!cached);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("bad response");
      const data = (await res.json()) as { suggestion?: string };
      const suggestion = (data.suggestion || "").trim();
      cacheRef.current.set(query, suggestion);
      setGhost(suggestion);
      setChipVisible(!!suggestion);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
  }, [setGhost, setChipVisible]);

  useEffect(() => {
    const trimmed = input.trim();
    if (!trimmed) {
      setGhost("");
      setChipVisible(false);
      return;
    }

    const local = localPredict(input);
    let chosen = local.suggestion || "";
    let confidence = local.confidence || 0;

    const pref = getPreferenceSuggestion(input);
    if (pref && pref.suggestion && pref.score > confidence) {
      chosen = pref.suggestion;
      confidence = pref.score;
    }

    setGhost(chosen);
    setChipVisible(false);

    const highConfidence = confidence >= 0.88;
    if (highConfidence) return;

    const now = Date.now();
    const since = now - lastReqAt;
    const debounceMs = 200;
    const throttleMs = 300;

    const delay = Math.max(debounceMs, throttleMs - Math.max(0, since));
    const timeout: ReturnType<typeof setTimeout> = setTimeout(async () => {
      setLastReqAt(Date.now());
      await request(input);
    }, delay);

    return () => clearTimeout(timeout);
  }, [input, lastReqAt, request, setGhost, setChipVisible]);

  return null;
}
