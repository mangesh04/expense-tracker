import { useState } from "react";
import { fmt, involves, nets } from "../lib/ledger";

export default function Friends({ S, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const n = nets(S.tx);

  const add = (e) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    const e1 = onAdd(v);
    setErr(e1 || "");
    if (!e1) setName("");
  };

  const remove = (p) => {
    if (S.tx.some((t) => involves(t, p.id))) return setErr("Delete " + p.name + "’s entries in Activity before removing them.");
    setErr("");
    onRemove(p.id);
  };

  return (
    <section>
      <form className="inline" id="fform" onSubmit={add} autoComplete="off">
        <input maxLength={30} placeholder="Add a friend or lender" aria-label="Friend name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="primary" type="submit">Add</button>
      </form>
      <p className="err" role="alert">{err}</p>
      <div>
        {!S.people.length && <p className="empty">Add friends to track who paid, who owes whom, and repayments.</p>}
        {S.people.map((p) => {
          const v = n[p.id] || 0;
          return (
            <div className="fr" key={p.id}>
              <div>
                <div className="nm">{p.name}</div>
                <div className={"st " + (v > 0 ? "pos" : v < 0 ? "neg" : "lbl")}>
                  {v > 0 ? "Owes you " + fmt(v) : v < 0 ? "You owe " + fmt(-v) : "All settled"}
                </div>
              </div>
              <button className="del" aria-label="Remove friend" onClick={() => remove(p)}>×</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
