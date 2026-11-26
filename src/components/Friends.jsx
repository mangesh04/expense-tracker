import { useState } from "react";
import { fmt, involves, nets } from "../lib/ledger";

export default function Friends({ S, onAdd, onRemove, onSetBank }) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null); // { id, value }
  const n = nets(S.tx);

  const add = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    const e1 = onAdd(v, bank.trim());
    setErr(e1 || "");
    if (!e1) { setName(""); setBank(""); }
  };

  const remove = (p) => {
    if (S.tx.some((t) => involves(t, p.id))) return setErr("Delete " + p.name + "’s entries in Activity before removing them.");
    setErr("");
    onRemove(p.id);
  };

  const saveBank = (e) => {
    e.preventDefault();
    const e1 = onSetBank(editing.id, editing.value.trim());
    setErr(e1 || "");
    if (!e1) setEditing(null);
  };

  return (
    <section>
      <form className="grid" id="fform" onSubmit={add} autoComplete="off">
        <input maxLength={30} placeholder="Nickname (what you call them)" aria-label="Nickname" value={name} onChange={(e) => setName(e.target.value)} />
        <input maxLength={60} placeholder="Real bank name, as shown in PhonePe (optional)" aria-label="Real bank name" value={bank} onChange={(e) => setBank(e.target.value)} />
        <button className="primary" type="submit">Add friend</button>
      </form>
      <p className="err" role="alert">{err}</p>
      <div>
        {!S.people.length && <p className="empty">Add friends to track who paid, who owes whom, and repayments.</p>}
        {S.people.map((p) => {
          const v = n[p.id] || 0;
          const isEditing = editing && editing.id === p.id;
          return (
            <div className="fr" key={p.id}>
              <div>
                <div className="nm">{p.name}</div>
                <div className={"st " + (v > 0 ? "pos" : v < 0 ? "neg" : "lbl")}>
                  {v > 0 ? "Owes you " + fmt(v) : v < 0 ? "You owe " + fmt(-v) : "All settled"}
                </div>
                {isEditing ? (
                  <form className="inline bk" onSubmit={saveBank}>
                    <input autoFocus maxLength={60} aria-label={"Real bank name for " + p.name} placeholder="Real bank name" value={editing.value}
                      onChange={(e) => setEditing({ id: p.id, value: e.target.value })} />
                    <button className="primary" type="submit">Save</button>
                  </form>
                ) : (
                  <div className="bk lbl">
                    {p.bankName ? "Bank name: " + p.bankName : "No bank name yet"}{" "}
                    <button className="link fedit" type="button" onClick={() => setEditing({ id: p.id, value: p.bankName || "" })}>
                      {p.bankName ? "Edit" : "Add"}
                    </button>
                  </div>
                )}
              </div>
              <button className="del" aria-label="Remove friend" onClick={() => remove(p)}>×</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
