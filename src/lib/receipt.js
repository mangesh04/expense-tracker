// Pure helpers that turn OCR output from a PhonePe payment screenshot into
// { amount, name, direction, date, txnId, status } and match the name to a friend.
import { fmt, nets, pad } from "./ledger.js";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const SKIP_AMOUNT = /\b(id|utr|ref|a\/c|acc|account|card|mobile|phone|upi|bank)\b|xxxx|\*{3,}|\+91|\d{2}:\d{2}/i;

const toIso = (y, m, d) => {
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  const iso = y + "-" + pad(m) + "-" + pad(d);
  // A payment screenshot can't be from the future (allow a day for timezone slack).
  const limit = new Date(); limit.setDate(limit.getDate() + 1);
  return dt <= limit ? iso : null;
};

export function findDate(text) {
  let m;
  if ((m = text.match(/(\d{4})-(\d{2})-(\d{2})/))) { const r = toIso(+m[1], +m[2], +m[3]); if (r) return r; }
  const re1 = /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})[,.\s\-]+(\d{4})\b/g;
  while ((m = re1.exec(text))) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mo >= 0) { const r = toIso(+m[3], mo + 1, +m[1]); if (r) return r; }
  }
  const re2 = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?[,\s]+(\d{4})\b/g;
  while ((m = re2.exec(text))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mo >= 0) { const r = toIso(+m[3], mo + 1, +m[2]); if (r) return r; }
  }
  if ((m = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/))) { const r = toIso(+m[3], +m[2], +m[1]); if (r) return r; }
  return null;
}

const NUM = "(\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d{1,2})?|\\d{1,7}(?:\\.\\d{1,2})?)";
// ₹ is often misread (%, ?, T, X, z, ¥) or dropped, so also accept a bare number on its own line.
const WITH_SYMBOL = new RegExp("(?<![A-Za-z])(?:₹|Rs\\.?|INR|[%?¥zZTX])\\s?" + NUM + "(?!\\d)");
const BARE_NUMBER = new RegExp("^" + NUM + "$");

function findAmount(lines) {
  const cands = [];
  for (const l of lines) {
    if (SKIP_AMOUNT.test(l.text)) continue;
    const m = l.text.match(WITH_SYMBOL) || l.text.match(BARE_NUMBER);
    if (!m) continue;
    const value = parseFloat(m[1].replace(/,/g, ""));
    if (value > 0) cands.push({ value, h: l.height || 0, explicit: /₹|Rs|INR/.test(l.text) });
  }
  if (!cands.length) return null;
  // The paid amount is the biggest text on the screen.
  cands.sort((a, b) => b.h - a.h || Number(b.explicit) - Number(a.explicit));
  return cands[0].value;
}

function cleanName(s) {
  return s
    .replace(/[^A-Za-z.'&\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findName(lines) {
  const re = /^(paid\s+to|payment\s+to|sent\s+to|transferred\s+to|received\s+from|to|from)\b\s*[:\-]?\s*(.*)$/i;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].text.match(re);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === "from" && !/^\s*[A-Za-z]/.test(m[2])) continue;
    const direction = key.startsWith("received") || key === "from" ? "received" : "paid";
    let raw = m[2];
    if (cleanName(raw).length < 2 && lines[i + 1]) raw = lines[i + 1].text;
    const name = cleanName(raw);
    // "From HDFC Bank" style lines are the account, not a person.
    if (name.length >= 2 && !/\b(bank|account|a\/c)\b/i.test(name)) return { name, direction };
  }
  return { name: "", direction: "paid" };
}

export function parseReceipt({ text = "", lines = [] }) {
  const ls = (lines.length ? lines : text.split("\n").map((t) => ({ text: t, height: 0 })))
    .map((l) => ({ ...l, text: l.text.trim() }))
    .filter((l) => l.text);
  const all = ls.map((l) => l.text).join("\n");

  let status = "unknown";
  if (/\b(failed|declined|reversed|cancelled|canceled)\b/i.test(all)) status = "failed";
  else if (/\bpending\b|\bprocessing\b/i.test(all)) status = "pending";
  else if (/\b(successful|success|completed)\b/i.test(all)) status = "success";

  const txn = all.match(/\b(T\d{15,25})\b/);
  const utr = all.match(/UTR\s*(?:No\.?|number)?\s*[:\-]?\s*(\d{8,14})/i);
  const { name, direction } = findName(ls);

  return {
    status,
    amount: findAmount(ls),
    name,
    direction,
    date: findDate(all),
    txnId: txn ? txn[1] : utr ? utr[1] : "",
  };
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const tokens = (s) => s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);

/**
 * Match the payee name on the screenshot to a friend.
 * A friend with a saved bank name is matched on that (strict, so two "Rahul"s don't get mixed up).
 * A friend without one falls back to the nickname (looser).
 * Returns null when nothing matches or when two friends match equally well.
 */
export function matchFriend(name, people) {
  const pt = tokens(name);
  if (!pt.length) return null;
  const ptStr = pt.join(" ");
  const scored = [];
  for (const p of people) {
    const bank = tokens(p.bankName || "");
    let score = 0;
    if (bank.length) {
      const bs = bank.join(" ");
      if (bs === ptStr) score = 1;
      else if (bank.every((t) => pt.includes(t)) || pt.every((t) => bank.includes(t))) score = 0.9;
      else if (1 - lev(bs, ptStr) / Math.max(bs.length, ptStr.length) >= 0.85) score = 0.8; // OCR typo
    } else {
      const ft = tokens(p.name);
      if (!ft.length) continue;
      if (ft.join(" ") === ptStr) score = 0.95;
      else if (ft.every((t) => pt.includes(t)) || pt.every((t) => ft.includes(t))) score = 0.85;
      else if (ft[0].length >= 4 && pt.some((t) => lev(t, ft[0]) <= 1)) score = 0.7;
    }
    if (score) scored.push({ person: p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored[1] && scored[1].score === scored[0].score) return null; // ambiguous
  return scored[0];
}

/**
 * Decide which Loan / repay entry a scanned payment to/from a friend should be,
 * from what you currently owe each other.
 */
export function planFor(person, r, tx) {
  const bal = nets(tx)[person.id] || 0; // > 0: they owe you, < 0: you owe them
  const amt = r.amount || 0;
  const n = person.name;
  if (r.direction === "paid") {
    if (bal < 0) {
      const extra = amt > -bal ? " The extra " + fmt(amt + bal) + " will show as " + n + " owing you." : "";
      return { kind: "paidback", text: "You owed " + n + " " + fmt(-bal) + ", so this is recorded as paying them back." + extra };
    }
    return { kind: "lent", text: bal > 0 ? n + " already owed you " + fmt(bal) + "; this adds to it." : "Recorded as lending " + n + " money." };
  }
  if (bal > 0) {
    const extra = amt > bal ? " The extra " + fmt(amt - bal) + " will show as you owing them." : "";
    return { kind: "gotback", text: n + " owed you " + fmt(bal) + ", so this is recorded as them paying you back." + extra };
  }
  return { kind: "borrowed", text: bal < 0 ? "You already owed " + n + " " + fmt(-bal) + "; this adds to it." : "Recorded as borrowing from " + n + "." };
}

export const alreadyLogged = (tx, txnId) => (txnId ? tx.find((t) => t.txnId === txnId) || null : null);
