import { useState } from "react";
import { useLedger } from "./hooks/useLedger";
import { fmt, nets, pad, r2, today } from "./lib/ledger";
import Auth from "./components/Auth";
import EntryPanel from "./components/EntryPanel";
import Activity from "./components/Activity";
import Spending from "./components/Spending";
import Friends from "./components/Friends";

export default function App() {
  const { S, phase, status, update, auth, signOut } = useLedger();
  const [tab, setTab] = useState("activity");
  const [view, setView] = useState(today().slice(0, 7));
  const [panel, setPanel] = useState(null); // { mode, n } | null

  if (phase === "loading") return <main><p className="empty">Loading…</p></main>;
  if (phase === "auth") return <main><Auth onAuth={auth} /></main>;

  const readOnly = phase === "offline";
  const n = nets(S.tx);
  let owe = 0, owed = 0;
  Object.values(n).forEach((v) => { if (v < 0) owe -= v; else owed += v; });

  const openPanel = (mode) => setPanel((p) => ({ mode, n: (p?.n || 0) + 1 }));

  const addTx = (t) => {
    update((s) => {
      const next = { ...s, tx: [...s.tx, t] };
      if (t.acct) next[t.acct] = r2((s[t.acct] || 0) + t.balDelta);
      return next;
    });
    setPanel(null);
  };
  const delTx = (t) =>
    update((s) => {
      const next = { ...s, tx: s.tx.filter((x) => x.id !== t.id) };
      if (t.acct) next[t.acct] = r2(s[t.acct] - t.balDelta);
      return next;
    });
  const bankClash = (bank, exceptId) => {
    const key = bank.toLowerCase().replace(/\s+/g, " ");
    const hit = bank && S.people.find((p) => p.id !== exceptId && (p.bankName || "").toLowerCase().replace(/\s+/g, " ") === key);
    return hit ? "That bank name is already saved for " + hit.name + "." : "";
  };
  const addFriend = (name, bankName = "") => {
    if (S.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return name + " is already on the list.";
    const clash = bankClash(bankName);
    if (clash) return clash;
    update((s) => ({ ...s, people: [...s.people, { id: "p" + Date.now(), name, ...(bankName ? { bankName } : {}) }] }));
    return "";
  };
  const setBankName = (id, bankName) => {
    const clash = bankClash(bankName, id);
    if (clash) return clash;
    update((s) => ({
      ...s,
      people: s.people.map((p) => {
        if (p.id !== id) return p;
        const { bankName: _old, ...rest } = p;
        return bankName ? { ...rest, bankName } : rest;
      }),
    }));
    return "";
  };
  const removeFriend = (id) => update((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) }));
  const shift = (m) => {
    const [y, mo] = view.split("-").map(Number);
    const d = new Date(y, mo - 1 + m, 1);
    setView(d.getFullYear() + "-" + pad(d.getMonth() + 1));
  };

  return (
    <main className={readOnly ? "ro" : ""}>
      {readOnly && <p className="banner" role="status">{status}</p>}

      <div className="hero">
        <div className="card">
          <div className="lbl">You have</div>
          <div className="num">{fmt(S.cash + S.online)}</div>
          <div className="acc">
            <span>Cash <b>{fmt(S.cash)}</b></span>
            <span>Online <b>{fmt(S.online)}</b></span>
          </div>
          <button className="link" id="adjbtn" type="button" style={{ marginTop: 12 }} onClick={() => openPanel("balance")}>
            Update balance
          </button>
        </div>
        <div className="side">
          <div className="card"><div className="lbl">You owe</div><div className="num2 neg">{fmt(owe)}</div></div>
          <div className="card"><div className="lbl">Owed to you</div><div className="num2 pos">{fmt(owed)}</div></div>
        </div>
      </div>

      <button className="primary" id="toggle" type="button" onClick={() => (panel ? setPanel(null) : openPanel("expense"))}>
        {panel ? "Close" : "Add entry"}
      </button>

      {panel && <EntryPanel key={panel.n} people={S.people} tx={S.tx} initialMode={panel.mode} onSave={addTx} onLinkFriend={setBankName} />}

      <nav className="tabs">
        {[["activity", "Activity"], ["spending", "Spending"], ["friends", "Friends"]].map(([id, l]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{l}</button>
        ))}
      </nav>

      {tab === "activity" && <Activity S={S} onDelete={delTx} />}
      {tab === "spending" && <Spending tx={S.tx} view={view} onShift={shift} />}
      {tab === "friends" && <Friends S={S} onAdd={addFriend} onRemove={removeFriend} onSetBank={setBankName} />}

      <div className="foot">
        <span>{readOnly ? "" : status}</span>
        <button className="link" type="button" onClick={signOut}>Sign out</button>
      </div>
    </main>
  );
}
