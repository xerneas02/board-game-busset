"use client";

import { FormEvent, useState } from "react";
import { Dices, KeyRound } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (!response.ok) return setError("Ce n’est pas le bon mot de passe.");
    const requested = new URLSearchParams(location.search).get("next");
    location.assign(requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/");
  }

  return <main className="login-page"><section className="login-panel"><Dices className="login-dice"/><p>Notre ludothèque</p><h1>Sous l’escalier</h1><form onSubmit={unlock}><label htmlFor="family-password">Mot de passe familial</label><div className="password-field"><KeyRound/><input id="family-password" type="password" autoComplete="current-password" autoFocus required value={password} onChange={event=>{setPassword(event.target.value);setError("")}}/></div>{error&&<p className="login-error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?"Ouverture…":"Entrer"}</button></form></section></main>;
}
