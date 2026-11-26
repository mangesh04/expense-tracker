import { useState } from "react";

export default function Auth({ onAuth }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");

  const go = async (kind) => setErr(await onAuth(kind, email.trim(), pw));

  return (
    <section className="card" id="auth">
      <div className="lbl">Sign in to sync your expenses. First time? Tap Create account.</div>
      <form className="grid" onSubmit={(e) => { e.preventDefault(); go("in"); }}>
        <input type="email" placeholder="Email" aria-label="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" aria-label="Password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <p className="err" role="alert">{err}</p>
        <button className="primary" type="submit">Sign in</button>
        <button className="ghost" type="button" onClick={() => go("up")}>Create account</button>
      </form>
    </section>
  );
}
