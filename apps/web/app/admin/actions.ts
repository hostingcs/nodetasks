"use server";

import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  verifyCredentials,
} from "@/lib/auth";

export async function loginAction(formData: FormData): Promise<void> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");

  if (!username || !password) {
    redirect("/admin/login?error=missing");
  }

  if (!verifyCredentials(username, password)) {
    redirect("/admin/login?error=invalid");
  }

  await createSession(username);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
