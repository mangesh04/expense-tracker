import { CATS, fmt, owedToMe } from "../lib/ledger";

export default function Spending({ tx, view, onShift }) {
  const [y, m] = view.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  let spent = 0, friendPaid = 0;
  const by = {};
  tx.forEach((t) => {
    if (t.type !== "expense" || t.date.slice(0, 7) !== view) return;
    if (t.paidBy === "me") {
      const mine = t.amount - owedToMe(t);
      spent += mine;
      by[t.cat] = (by[t.cat] || 0) + mine;
    } else friendPaid += t.amount;
  });
  const cats = Object.entries(by).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);

  return (
    <section>
      <div className="month">
        <button className="nav" aria-label="Previous month" onClick={() => onShift(-1)}>‹</button>
        <b>{label}</b>
        <button className="nav" aria-label="Next month" onClick={() => onShift(1)}>›</button>
      </div>
      <div className="spent">{fmt(spent)}</div>
      <div className="lbl">
        {spent || friendPaid
          ? "Your share of what you paid" + (friendPaid ? ". Friends paid " + fmt(friendPaid) + " for you." : ".")
          : "Nothing logged this month."}
      </div>
      <div className="bar" role="img" aria-label="Spending by category">
        {cats.map(([c, v]) => <i key={c} style={{ width: (v / spent) * 100 + "%", background: CATS[c] }}></i>)}
      </div>
      <ul className="legend">
        {cats.map(([c, v]) => (
          <li key={c}><span style={{ background: CATS[c] }}></span>{c} <em>{fmt(v)}</em></li>
        ))}
      </ul>
    </section>
  );
}
