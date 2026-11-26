import { useCallback, useEffect, useRef, useState } from "react";
import { sb } from "../lib/supabase";
import { blank, cacheLocal, loadLocal } from "../lib/ledger";

const UID_KEY = "ledger-last-user";

/**
 * phase: "loading" | "auth" | "ready" | "offline"
 * "offline" = signed in before but the server can't be reached: shows saved data, read-only.
 */
export function useLedger() {
  const [S, setS] = useState(loadLocal);
  const [phase, setPhase] = useState("loading");
  const [status, setStatus] = useState("");
  const ref = useRef(S);
  const uid = useRef(null);
  const synced = useRef(false);
  const timer = useRef(null);

  const push = useCallback((next) => {
    if (!uid.current || !synced.current) return;
    clearTimeout(timer.current);
    setStatus("Saving…");
    timer.current = setTimeout(async () => {
      const { error } = await sb
        .from("expense_tracker")
        .upsert({ user_id: uid.current, data: next, updated_at: new Date().toISOString() });
      setStatus(error ? "Not saved: " + error.message : "Saved");
    }, 600);
  }, []);

  const update = useCallback((fn) => {
    const next = fn(ref.current);
    ref.current = next;
    setS(next);
    cacheLocal(next);
    push(next);
  }, [push]);

  const start = useCallback(async (user) => {
    uid.current = user.id;
    const { data, error } = await sb.from("expense_tracker").select("data").eq("user_id", user.id).maybeSingle();
    if (error) {
      setStatus("Couldn’t reach the server. Showing saved data (read-only).");
      setPhase("offline");
      return;
    }
    synced.current = true;
    try { localStorage.setItem(UID_KEY, user.id); } catch { /* ignore */ }
    if (data && data.data && Object.keys(data.data).length) {
      const next = { ...blank(), ...data.data };
      ref.current = next;
      setS(next);
      cacheLocal(next);
    } else {
      push(ref.current);
    }
    setStatus("");
    setPhase("ready");
  }, [push]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (data.session) return await start(data.session.user);
      } catch { /* fall through */ }
      const wasSignedIn = (() => { try { return !!localStorage.getItem(UID_KEY); } catch { return false; } })();
      if (!navigator.onLine && wasSignedIn) {
        setStatus("You’re offline. Showing saved data (read-only).");
        setPhase("offline");
      } else {
        setPhase("auth");
      }
    })();
  }, [start]);

  // When back online, try to load from the server again.
  useEffect(() => {
    if (phase !== "offline") return;
    const retry = async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (data.session) await start(data.session.user);
      } catch { /* still offline */ }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [phase, start]);

  const auth = useCallback(async (kind, email, password) => {
    const res = kind === "up"
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });
    if (res.error) return res.error.message;
    if (res.data.session) { await start(res.data.user); return ""; }
    return "Check your email to confirm, then sign in.";
  }, [start]);

  const signOut = useCallback(async () => {
    try { await sb.auth.signOut(); } catch { /* ignore */ }
    try { localStorage.removeItem(UID_KEY); } catch { /* ignore */ }
    location.reload();
  }, []);

  return { S, phase, status, update, auth, signOut };
}
