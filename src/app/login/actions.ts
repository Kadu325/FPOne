"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { AUTH_MESSAGES, messageForCode } from "@/lib/auth/errors";
import { describeError, logAuthEvent } from "@/lib/logger";

export interface LoginState {
  error?: string;
}

/** Aceita apenas caminhos internos (evita open redirect via ?callbackUrl=). */
function safeCallbackUrl(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/login")) return "/";
  return value;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = formData.get("username");
  const password = formData.get("password");

  try {
    await signIn("credentials", {
      username: typeof username === "string" ? username : "",
      password: typeof password === "string" ? password : "",
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
    return {};
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { error: messageForCode(error.code) };
    }
    if (error instanceof AuthError) {
      logAuthEvent("error", "auth.signin_error", describeError(error));
      return { error: AUTH_MESSAGES.service_unavailable };
    }
    // Sucesso: o signIn lança o redirect do Next — precisa ser propagado.
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
