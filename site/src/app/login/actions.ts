"use server";

import { redirect } from "next/navigation";
import { ALLOWED_EMAIL } from "@/lib/env";
import { serverClient } from "@/lib/supabase";

export type LoginState = { step: "email" | "code"; email?: string; error?: string };

export async function requestCode(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (email !== ALLOWED_EMAIL) return { step: "email", error: "That email is not allowed here." };

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) return { step: "email", error: "Could not send a code. Try again in a minute." };
  return { step: "code", email };
}

export async function verifyCode(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  if (email !== ALLOWED_EMAIL) return { step: "email", error: "That email is not allowed here." };
  if (!/^\d{6}$/.test(token)) return { step: "code", email, error: "Enter the 6-digit code." };

  const supabase = await serverClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "That code did not work. Check it or request a new one." };
  redirect("/design");
}
