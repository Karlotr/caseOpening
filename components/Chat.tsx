"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { coins, errMsg } from "@/lib/format";
import { modeLabel, normBattle, type Battle } from "@/lib/battles";
import { useAuth } from "./AuthProvider";
import { useToast } from "./Toast";

type Msg = { id: number; user_id: string; username: string; level: number; body: string; battle_id: string | null; created_at: string };
type Ctx = { open: boolean; setOpen: (o: boolean) => void; shareBattle: (id: string) => Promise<void> };
const ChatCtx = createContext<Ctx>({ open: false, setOpen: () => {}, shareBattle: async () => {} });
export const useChat = () => useContext(ChatCtx);

const levelColor = (l: number) => (l >= 50 ? "#f43f5e" : l >= 35 ? "#ec4899" : l >= 20 ? "#a78bfa" : l >= 10 ? "#8fcbeb" : l >= 5 ? "#34d399" : "#8d9cb8");

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  useEffect(() => {
    try {
      if (window.matchMedia("(min-width: 1280px)").matches && localStorage.getItem("garaza-chat") !== "0") setOpenState(true);
    } catch {}
  }, []);
  const setOpen = useCallback((o: boolean) => {
    setOpenState(o);
    try {
      localStorage.setItem("garaza-chat", o ? "1" : "0");
    } catch {}
  }, []);
  const shareBattle = useCallback(
    async (id: string) => {
      if (!user) return toast("Prijavi se da bi pisao u chat.", "error");
      const { error } = await createClient().rpc("send_chat", { p_body: "", p_battle_id: id });
      if (error) return toast(errMsg(error), "error");
      toast("Battle je podijeljen u chat.", "success");
      setOpen(true);
    },
    [user, toast, setOpen]
  );
  return (
    <ChatCtx value={{ open, setOpen, shareBattle }}>
      <div className={`transition-[padding] ${open ? "xl:pr-[340px]" : ""} flex min-h-full flex-1 flex-col`}>{children}</div>
      <ChatPanel />
    </ChatCtx>
  );
}

function ChatPanel() {
  const { open, setOpen } = useChat();
  const { user, profile } = useAuth();
  const toast = useToast();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [battles, setBattles] = useState<Map<string, Battle>>(new Map());
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    if (open) setUnread(0);
  }, [open]);

  const loadBattles = useCallback(async (ids: string[]) => {
    const need = ids.filter((x) => x);
    if (!need.length) return;
    const { data } = await createClient().from("battles").select("*").in("id", need);
    if (data) setBattles((m) => new Map([...m, ...data.map((b) => [b.id as string, normBattle(b)] as const)]));
  }, []);

  const load = useCallback(async () => {
    const { data } = await createClient().from("chat_messages").select("*").order("created_at", { ascending: false }).limit(80);
    if (!data) return;
    const rows = (data as Msg[]).reverse();
    setMsgs((prev) => {
      const lastPrev = prev[prev.length - 1]?.id ?? 0;
      const fresh = rows.filter((r) => r.id > lastPrev).length;
      if (prev.length && fresh && !openRef.current) setUnread((u) => u + fresh);
      return rows;
    });
    loadBattles(rows.map((r) => r.battle_id ?? ""));
  }, [loadBattles]);

  useEffect(() => {
    load();
    const sb = createClient();
    const ch = sb
      .channel("chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => load())
      .subscribe();
    const t = setInterval(load, 10000);
    return () => {
      sb.removeChannel(ch);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    const { error } = await createClient().rpc("send_chat", { p_body: text });
    setSending(false);
    if (error) return toast(errMsg(error), "error");
    setText("");
    load();
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full border border-line bg-panel2 px-4 py-2.5 font-display text-lg font-bold shadow-2xl hover:border-accent2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12Z" /></svg>
          Chat
          {unread > 0 && <span className="rounded-full bg-accent px-1.5 text-sm text-ink">{unread}</span>}
        </button>
      )}
      <aside
        aria-label="Chat"
        className={`fixed bottom-0 right-0 top-[67px] z-40 flex w-full max-w-[340px] flex-col border-l border-line bg-ink/95 backdrop-blur transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="font-display text-2xl font-black leading-none">Chat</div>
            <div className="text-xs text-muted">Poruke nestaju nakon 6 sati</div>
          </div>
          <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-panel hover:text-fg" aria-label="Zatvori chat">✕</button>
        </div>
        <div ref={list} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
          {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">Tiho je u garaži. Napiši prvu poruku.</p>}
          {msgs.map((m) => {
            const b = m.battle_id ? battles.get(m.battle_id) : null;
            const mine = m.user_id === user?.id;
            return (
              <div key={m.id} className="drop-in">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="grid h-5 min-w-5 place-items-center rounded px-1 font-display text-xs font-black text-ink" style={{ background: levelColor(m.level) }} title={`Level ${m.level}`}>
                    {m.level}
                  </span>
                  <span className={`font-semibold ${mine ? "text-accent2" : ""}`}>{m.username}</span>
                  <span className="ml-auto text-xs text-muted">{new Date(m.created_at).toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-0.5 break-words pl-[26px] text-[15px] leading-snug text-fg/90">{m.body}</p>
                {m.battle_id && (
                  <Link href={`/battles/${m.battle_id}`} className="ml-[26px] mt-1.5 block rounded-lg border border-line bg-panel p-2.5 transition hover:border-accent">
                    {b ? (
                      <div className="flex items-center gap-3">
                        <span className="font-display text-2xl font-black leading-none">{b.mode}</span>
                        <div className="min-w-0 flex-1 text-xs text-muted">
                          {modeLabel(b)} · {b.case_ids.length} kutija
                          <div className="font-display text-base font-bold text-accent">{coins(b.cost)}</div>
                        </div>
                        <span className={`rounded px-2 py-1 font-display text-sm font-bold ${b.status === "waiting" ? "bg-accent text-ink" : "bg-panel2 text-muted"}`}>
                          {b.status === "waiting" ? "Uđi" : b.status === "finished" ? "Gotov" : "Otkazan"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted">Battle</span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        {user ? (
          <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
            <input className="input" maxLength={300} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Piši kao ${profile?.username ?? ""}…`} aria-label="Poruka" />
            <button className="btn-primary px-4" disabled={sending || !text.trim()}>Pošalji</button>
          </form>
        ) : (
          <div className="border-t border-line p-3 text-center text-sm text-muted">
            <Link href="/login" className="text-accent2">Prijavi se</Link> da bi pisao u chat.
          </div>
        )}
      </aside>
    </>
  );
}
