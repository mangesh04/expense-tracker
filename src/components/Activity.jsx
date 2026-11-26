import { CATS, debtsOf, fmt } from "../lib/ledger";

export default function Activity({ S, onDelete }) {
  const name = (id) => (S.people.find((p) => p.id === id) || { name: "Unknown" }).name;
  const rows = [...S.tx].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 60);

  if (!rows.length) {
    return <ul className="list"><li className="empty">Nothing yet. Set your cash and online balance above, then add an entry.</li></ul>;
  }

  return (
    <ul className="list">
      {rows.map((t) => {
        const d = new Date(t.date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });
        const sub = [d];
        let title, dot;

        if (t.type === "adjust") {
          title = (t.balDelta > 0 ? "Money in" : "Money out") + (t.note ? ": " + t.note : "");
        } else if (t.type === "transfer") {
          const L = { lent: "Lent to ", borrowed: "Borrowed from ", paidback: "Paid back " };
          const k = t.kind || (t.balDelta < 0 ? "lent" : "borrowed");
          title = k === "gotback" ? name(t.person) + " paid you back" : L[k] + name(t.person);
          if (t.note) sub.push(t.note);
        } else {
          title = t.note || t.cat;
          dot = CATS[t.cat] || CATS.Other;
          if (t.paidBy !== "me") {
            sub.push("Paid by " + name(t.paidBy) + (t.debtDelta < 0 ? ", you owe " + fmt(-t.debtDelta) : ", record only"));
          } else {
            const owes = debtsOf(t).filter((x) => x.delta > 0);
            if (owes.length === 1) sub.push(name(owes[0].person) + " owes you " + fmt(owes[0].delta));
            else if (owes.length > 1) sub.push("Owe you: " + owes.map((x) => name(x.person) + " " + fmt(x.delta)).join(", "));
          }
          if (t.note) sub.push(t.cat);
        }
        if (t.acct) sub.push(t.acct === "cash" ? "Cash" : "Online");

        return (
          <li className="row" key={t.id}>
            <span className="dot" style={dot ? { background: dot } : undefined}></span>
            <div className="t"><div>{title}</div><small>{sub.join(", ")}</small></div>
            <span className={"amt" + (t.balDelta ? "" : " rec")}>
              {(t.balDelta > 0 ? "+" : t.balDelta < 0 ? "−" : "") + fmt(t.amount)}
            </span>
            <button className="del" aria-label="Delete entry" onClick={() => onDelete(t)}>×</button>
          </li>
        );
      })}
    </ul>
  );
}
