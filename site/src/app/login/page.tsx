import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <main className="login">
      <div className="login-card">
        <h1 className="page-title">inspiration</h1>
        <p className="lede">Private. Log in to continue.</p>
        <LoginForm />
      </div>
    </main>
  );
}
