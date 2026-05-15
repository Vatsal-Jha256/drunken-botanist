"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg(null);
    const supabase = createClient();
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="specimen-card rounded-md p-6 text-center">
        <p className="font-serif text-xl text-ink">Check your inbox.</p>
        <p className="text-sm text-ink-soft mt-2">
          We sent a magic link to <strong>{email}</strong>. Click it and you&apos;re in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="specimen-card rounded-md p-6 space-y-4">
      <label className="block">
        <span className="smallcaps text-xs text-ink-soft">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@somewhere.com"
          className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
        />
      </label>
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full bg-sage text-parchment py-2 rounded-sm smallcaps text-sm hover:bg-sage-deep disabled:opacity-60"
      >
        {status === "sending" ? "Sending…" : "Send me a magic link"}
      </button>
      {errorMsg && (
        <p className="text-burgundy text-xs">{errorMsg}</p>
      )}
    </form>
  );
}
