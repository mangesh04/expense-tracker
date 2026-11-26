export const CUR = "₹";
export const KEY = "ledger-v2";
export const CATS = { Food: "#D9822B", Transport: "#3B82A6", Bills: "#7A6FB5", Shopping: "#C25B7A", Fun: "#4F9D69", Other: "#8A948E" };

export const r2 = (n) => Math.round(n * 100) / 100;
export const pad = (n) => String(n).padStart(2, "0");
export const today = () => {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
};
export const fmt = (n) => {
  n = r2(n);
  return CUR + n.toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export const blank = () => ({ cash: 0, online: 0, people: [], tx: [] });

export function loadLocal() {
  const S = blank();
  try {
    const r = localStorage.getItem(KEY);
    if (r) return Object.assign(S, JSON.parse(r));
    const o = localStorage.getItem("expenses-v1");
    if (o) {
      S.tx = JSON.parse(o).map((i) => ({
        id: i.id, type: "expense", amount: i.amount, cat: i.cat, date: i.date, note: i.note || "",
        paidBy: "me", acct: null, balDelta: 0, person: null, debtDelta: 0,
      }));
    }
  } catch {
    /* ignore */
  }
  return S;
}

export const cacheLocal = (S) => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignore */ }
};

/**
 * Who owes what because of one entry.
 * New expenses paid by me can be shared with several friends: t.splits = [{ person, amount }].
 * Older entries (and loans / friend-paid expenses) use a single t.person + t.debtDelta,
 * so existing saved data keeps working unchanged.
 */
export function debtsOf(t) {
  if (Array.isArray(t.splits)) return t.splits.map((s) => ({ person: s.person, delta: s.amount }));
  return t.person && t.debtDelta ? [{ person: t.person, delta: t.debtDelta }] : [];
}

/** Total friends owe me for an expense I paid. */
export const owedToMe = (t) =>
  t.paidBy === "me" ? debtsOf(t).reduce((a, d) => a + Math.max(d.delta, 0), 0) : 0;

export const involves = (t, id) => t.paidBy === id || t.person === id || debtsOf(t).some((d) => d.person === id);

export const nets = (tx) => {
  const m = {};
  tx.forEach((t) => debtsOf(t).forEach((d) => { m[d.person] = r2((m[d.person] || 0) + d.delta); }));
  return m;
};

/** Split an amount between n friends. includeMe=true means I take an equal share too. */
export function equalSplit(amount, n, includeMe) {
  const each = r2(amount / (includeMe ? n + 1 : n));
  const out = Array(n).fill(each);
  if (!includeMe && n > 0) out[n - 1] = r2(amount - each * (n - 1)); // last friend absorbs the odd paisa
  return out;
}
