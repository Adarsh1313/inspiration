"use server";

import { redirect } from "next/navigation";
import { ALLOWED_EMAIL } from "@/lib/env";
import { serverClient } from "@/lib/supabase";

export type LoginState = { error?: string };

const FAILED = "Email or password is wrong.";

export async function signIn(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (email !== ALLOWED_EMAIL || !password) return { error: FAILED };

  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: FAILED };
  redirect("/design");
}
