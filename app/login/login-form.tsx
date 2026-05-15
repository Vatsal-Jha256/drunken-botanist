"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up";
type Status = "idle" | "submitting" | "confirmation" | "error";

function authErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email and password did not match. Check them or create a new account.";
  }
  if (lower.includes("email not confirmed")) {
    return "This account still needs email confirmation. For the free-tier setup, turn off Confirm email in Supabase Auth or use custom SMTP.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Supabase is rate-limiting auth emails. Turn off Confirm email for the free-tier setup, or configure custom SMTP.";
  }
  return message;
}

export function LoginForm() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setStatus("idle");
    setErrorMsg(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !password) return;

    setStatus("submitting");
    setErrorMsg(null);

    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

    if (mode === "sign-in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("error");
        setErrorMsg(authErrorMessage(error.message));
        return;
      }
      window.location.assign("/");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(authErrorMessage(error.message));
      return;
    }

    if (data.session) {
      window.location.assign("/");
      return;
    }

    setStatus("confirmation");
  }

  if (status === "confirmation") {
    return (
      <div className="specimen-card rounded-md p-6 text-center">
        <p className="font-serif text-xl text-ink">Account created.</p>
        <p className="text-sm text-ink-soft mt-2">
          Supabase is waiting for email confirmation before sign-in. For this free-tier
          project, disable <strong>Confirm email</strong> in Supabase Auth to avoid auth
          email rate limits.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="specimen-card rounded-md p-6 space-y-4">
      <div className="grid grid-cols-2 rounded-sm border border-paper-edge overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => switchMode("sign-in")}
          className={`px-3 py-2 smallcaps ${
            mode === "sign-in"
              ? "bg-sage text-parchment"
              : "bg-parchment-deep/30 text-ink-soft hover:text-ink"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => switchMode("sign-up")}
          className={`px-3 py-2 smallcaps ${
            mode === "sign-up"
              ? "bg-sage text-parchment"
              : "bg-parchment-deep/30 text-ink-soft hover:text-ink"
          }`}
        >
          Sign up
        </button>
      </div>

      <label className="block">
        <span className="smallcaps text-xs text-ink-soft">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@somewhere.com"
          className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
        />
      </label>

      <label className="block">
        <span className="smallcaps text-xs text-ink-soft">Password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
        />
      </label>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-sage text-parchment py-2 rounded-sm smallcaps text-sm hover:bg-sage-deep disabled:opacity-60"
      >
        {status === "submitting"
          ? mode === "sign-in"
            ? "Signing in..."
            : "Creating account..."
          : mode === "sign-in"
            ? "Sign in"
            : "Create account"}
      </button>

      {errorMsg && <p className="text-burgundy text-xs">{errorMsg}</p>}
    </form>
  );
}
