"use client";

import { useActionState } from "react";
import { requestCode, verifyCode, type LoginState } from "./actions";

export function LoginForm() {
  const [email, emailAction, emailPending] = useActionState<LoginState, FormData>(requestCode, { step: "email" });
  const [code, codeAction, codePending] = useActionState<LoginState, FormData>(verifyCode, { step: "code" });

  if (email.step !== "code") {
    return (
      <form action={emailAction}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="input" autoComplete="email" autoFocus required />
        </div>
        {email.error && <p className="error" role="alert">{email.error}</p>}
        <button className="btn" disabled={emailPending}>{emailPending ? "Sending…" : "Email me a code"}</button>
      </form>
    );
  }

  return (
    <form action={codeAction}>
      <input type="hidden" name="email" value={email.email} />
      <p className="hint">We sent a 6-digit code to {email.email}.</p>
      <div className="field">
        <label htmlFor="code">Code</label>
        <input id="code" name="code" className="input code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus required />
      </div>
      {code.error && <p className="error" role="alert">{code.error}</p>}
      <button className="btn" disabled={codePending}>{codePending ? "Checking…" : "Log in"}</button>
    </form>
  );
}
