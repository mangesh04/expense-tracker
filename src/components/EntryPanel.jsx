import { useRef, useState } from "react";
import { CATS, equalSplit, fmt, r2, today } from "../lib/ledger";
import { alreadyLogged, matchFriend, planFor } from "../lib/receipt";
import { scanReceipt } from "../lib/scan";

const SPLIT_MODES = [
  ["cover", "They owe the full amount, split equally"],
  ["equal", "Split equally, including me"],
  ["custom", "Custom amount for each"],
];

export default function EntryPanel({ people, tx, initialMode, onSave, onLinkFriend }) {
  const [mode, setMode] = useState(initialMode);
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("Food");
  const [date, setDate] = useState(today());
  const [paid, setPaid] = useState("me");
  const [oweSel, setOweSel] = useState("rec");
  const [share, setShare] = useState("");
  const [dir, setDir] = useState("lent");
  const [bdir, setBdir] = useState("in");
  const [acct, setAcct] = useState("cash");
  const [note, setNote] = useState("");
  const [who, setWho] = useState("");
  const [picked, setPicked] = useState([]);
  const [splitMode, setSplitMode] = useState("cover");
  const [custom, setCustom] = useState({});
  const [err, setErr] = useState("");
  const [scan, setScan] = useState(null); // { busy, progress, result, match, dup, error }
  const [txnId, setTxnId] = useState("");
  const [payee, setPayee] = useState("");
  const fileRef = useRef(null);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr("");
    setScan({ busy: true, progress: 0 });
    try {
      const r = await scanReceipt(file, (progress) => setScan((s) => (s && s.busy ? { ...s, progress } : s)));
      const match = matchFriend(r.name, people);
      const dup = alreadyLogged(tx, r.txnId);
      if (r.amount) setAmount(String(r.amount));
      if (r.date) setDate(r.date);
      if (r.name) setNote((r.direction === "received" ? "Received from " : "Paid to ") + r.name.slice(0, 40));
      setAcct("online");
      setTxnId(r.txnId);
      setPayee(r.name);
      // A known friend: switch to Loan / repay and pick the entry type from what you owe each other.
      let plan = null;
      if (match) {
        plan = planFor(match.person, r, tx);
        setMode("transfer"); setWho(match.person.id); setDir(plan.kind);
      }
      setScan({ busy: false, result: r, match, dup, plan });
    } catch (ex) {
      setScan({ busy: false, error: ex.message || "Couldn’t read that image." });
    }
  }

  function clearScan() { setScan(null); setTxnId(""); setPayee(""); setErr(""); }

  function linkTo(id) {
    const person = people.find((p) => p.id === id);
    if (!person) return;
    const e1 = onLinkFriend(id, scan.result.name);
    if (e1) return setErr(e1);
    const plan = planFor(person, scan.result, tx);
    setMode("transfer"); setWho(id); setDir(plan.kind); setErr("");
    setScan((s) => ({ ...s, match: { person, score: 1 }, plan }));
  }

  const chosen = people.filter((p) => picked.includes(p.id));
  const amt = parseFloat(amount);
  const togglePick = (id) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const expenseByMe = mode === "expense" && paid === "me";
  const expenseByFriend = mode === "expense" && paid !== "me";
  const showAcct = expenseByMe || mode === "transfer" || mode === "balance";

  function submit(e) {
    e.preventDefault();
    if (!(amt > 0)) return setErr("Enter an amount greater than 0.");
    const r = scan?.result;
    if (r && r.status === "failed") return setErr("The screenshot shows a failed payment. Tap Clear scan to save it anyway.");
    if (r && scan.dup) return setErr("This payment is already logged. Tap Clear scan to save it anyway.");
    const t = {
      id: Date.now() + Math.random(), date: date || today(), note: note.trim(), amount: amt,
      acct: null, balDelta: 0, person: null, debtDelta: 0,
    };

    if (mode === "expense") {
      t.type = "expense"; t.cat = cat; t.paidBy = paid;
      if (paid === "me") {
        t.acct = acct; t.balDelta = -amt;
        if (chosen.length) {
          let amounts;
          if (splitMode === "custom") {
            amounts = chosen.map((p) => parseFloat(custom[p.id]) || 0);
            if (amounts.some((a) => a <= 0)) return setErr("Enter an amount for each selected friend.");
            if (r2(amounts.reduce((a, b) => a + b, 0)) > amt) return setErr("Amounts add up to more than " + fmt(amt) + ".");
          } else {
            amounts = equalSplit(amt, chosen.length, splitMode === "equal");
          }
          t.splits = chosen.map((p, i) => ({ person: p.id, amount: amounts[i] }));
        }
      } else {
        t.person = paid;
        const sv = parseFloat(share);
        if (oweSel === "owe") t.debtDelta = -(sv > 0 ? sv : amt);
      }
    } else if (mode === "balance") {
      if (!t.note) return setErr("Add a note so you remember why the balance changed.");
      t.type = "adjust"; t.acct = acct; t.balDelta = bdir === "in" ? amt : -amt;
    } else {
      if (!who) return setErr(people.length ? "Choose a friend." : "Add a friend in the Friends tab first.");
      const gave = dir === "lent" || dir === "paidback";
      t.type = "transfer"; t.kind = dir; t.person = who; t.acct = acct;
      t.balDelta = gave ? -amt : amt; t.debtDelta = gave ? amt : -amt;
    }
    if (txnId) t.txnId = txnId;
    if (payee) t.payee = payee;
    onSave(t);
  }

  const eachPreview = amt > 0 && chosen.length && splitMode !== "custom"
    ? equalSplit(amt, chosen.length, splitMode === "equal")[0] : null;

  return (
    <section className="card panel" id="panel">
      <div className="seg">
        {[["expense", "Expense"], ["transfer", "Loan / repay"], ["balance", "Balance"]].map(([m, l]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setErr(""); }}>{l}</button>
        ))}
      </div>

      <form className="grid" onSubmit={submit} autoComplete="off">
        {mode !== "balance" && (
          <>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            <button className="ghost" type="button" disabled={scan?.busy} onClick={() => fileRef.current.click()}>
              {scan?.busy ? "Reading screenshot… " + Math.round((scan.progress || 0) * 100) + "%" : "Scan PhonePe screenshot"}
            </button>
            {scan?.error && <p className="err" role="alert">{scan.error}</p>}
            {scan?.result && <ScanChecks scan={scan} people={people} onClear={clearScan} onLink={linkTo} />}
          </>
        )}
        <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="Amount" aria-label="Amount"
          value={amount} onChange={(e) => setAmount(e.target.value)} />

        {mode === "expense" && (
          <>
            <select className="half" aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}>
              {Object.keys(CATS).map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="half" type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
            <select aria-label="Paid by" value={paid} onChange={(e) => setPaid(e.target.value)}>
              <option value="me">Paid by me</option>
              {people.map((p) => <option key={p.id} value={p.id}>Paid by {p.name}</option>)}
            </select>
          </>
        )}
        {mode !== "expense" && (
          <input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
        )}

        {expenseByFriend && (
          <>
            <select aria-label="Record type" value={oweSel} onChange={(e) => setOweSel(e.target.value)}>
              <option value="rec">Just a record, I don’t owe anything</option>
              <option value="owe">I owe them for this</option>
            </select>
            {oweSel === "owe" && (
              <input type="number" inputMode="decimal" step="0.01" min="0" value={share}
                onChange={(e) => setShare(e.target.value)}
                placeholder="Amount you owe (default: full amount)" aria-label="Amount you owe" />
            )}
          </>
        )}

        {mode === "transfer" && (
          <select aria-label="What happened" value={dir} onChange={(e) => setDir(e.target.value)}>
            <option value="lent">I lent them money</option>
            <option value="borrowed">I borrowed from them</option>
            <option value="paidback">I paid them back</option>
            <option value="gotback">They paid me back</option>
          </select>
        )}

        {mode === "balance" && (
          <select aria-label="Direction" value={bdir} onChange={(e) => setBdir(e.target.value)}>
            <option value="in">Money in (salary, gift, starting balance)</option>
            <option value="out">Money out (not an expense)</option>
          </select>
        )}

        {mode === "transfer" && (
          <select aria-label="Friend" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="" disabled>Choose friend</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {expenseByMe && (
          <>
            <div className="fld-lbl">Paid for friends? Tap everyone who owes you</div>
            {people.length ? (
              <div className="chips" role="group" aria-label="Friends who owe you">
                {people.map((p) => (
                  <button key={p.id} type="button" className="chip" aria-pressed={picked.includes(p.id)} onClick={() => togglePick(p.id)}>
                    {p.name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">Add friends in the Friends tab to split expenses with them.</p>
            )}

            {chosen.length > 0 && (
              <select aria-label="How to split" value={splitMode} onChange={(e) => { setSplitMode(e.target.value); setErr(""); }}>
                {SPLIT_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}

            {chosen.length > 0 && splitMode === "custom" && (
              <div className="splitrows">
                {chosen.map((p) => (
                  <div className="splitrow" key={p.id}>
                    <span>{p.name} owes</span>
                    <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" aria-label={p.name + " owes"}
                      value={custom[p.id] || ""} onChange={(e) => setCustom((c) => ({ ...c, [p.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}

            {eachPreview !== null && (
              <p className="hint">
                {chosen.length > 1 ? "Each owes you about " : chosen[0].name + " owes you "}
                <b>{fmt(eachPreview)}</b>
              </p>
            )}
          </>
        )}

        {showAcct && (
          <select aria-label="Account" value={acct} onChange={(e) => setAcct(e.target.value)}>
            <option value="cash">From / to cash</option>
            <option value="online">From / to online</option>
          </select>
        )}

        <input type="text" maxLength={60} aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder={mode === "balance" ? "Note (required): why is the balance changing?" : "Note (optional)"} />
        <p className="err" role="alert">{err}</p>
        <button className="primary" type="submit">Save entry</button>
      </form>
    </section>
  );
}

function ScanChecks({ scan, people, onClear, onLink }) {
  const { result: r, match, dup, plan } = scan;
  const status = {
    success: ["ok", "Payment successful"],
    failed: ["bad", "Screenshot shows a failed payment"],
    pending: ["warn", "Payment looks pending"],
    unknown: ["warn", "Couldn’t find a “successful” message"],
  }[r.status];
  const rows = [
    status,
    r.amount ? ["ok", "Amount " + fmt(r.amount)] : ["warn", "Couldn’t read the amount, type it below"],
    r.name
      ? [match ? "ok" : "warn", (r.direction === "received" ? "From " : "To ") + r.name + (match ? " (matches " + match.person.name + ")" : " (not linked to a friend)")]
      : ["warn", "Couldn’t read the name"],
    r.txnId ? [dup ? "bad" : "ok", dup ? "Already logged on " + dup.date : "Not logged yet"] : ["warn", "No transaction ID found, so duplicates can’t be checked"],
  ];
  return (
    <div className="checks">
      {rows.map(([k, t], i) => <div key={i} className={"chk " + k}><span aria-hidden="true">{k === "ok" ? "✓" : "!"}</span> {t}</div>)}
      {plan && <div className="chk ok">{plan.text}</div>}
      {!match && r.name && people.length > 0 && (
        <select aria-label="Link this name to a friend" value="" onChange={(e) => onLink(e.target.value)}>
          <option value="" disabled>Link “{r.name}” to a friend…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <div className="chk-actions">
        <button type="button" className="link" onClick={onClear}>Clear scan</button>
      </div>
    </div>
  );
}
