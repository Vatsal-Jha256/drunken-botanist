"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string;
  resetMode: boolean;
};

function passwordErrorMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("same as the old password")) {
    return "Choose a password different from your current one.";
  }
  if (lower.includes("session")) {
    return "Your password-reset session expired. Use Forgot password from the sign-in page again.";
  }
  return message;
}

export function PasswordForm({ email, resetMode }: Props) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setStatus("error");
      setErrorMsg("Use at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMsg("Both password fields must match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("error");
      setErrorMsg(passwordErrorMessage(error.message));
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setStatus("saved");
  }

  return (
    <form onSubmit={onSubmit} className="specimen-card rounded-md p-6 space-y-4">
      <div>
        <p className="smallcaps text-xs text-ink-soft">Signed in as</p>
        <p className="font-serif text-lg text-ink break-words">{email}</p>
      </div>

      {resetMode && (
        <p className="rounded-sm border border-sage/40 bg-sage/10 px-3 py-2 text-xs text-sage-deep">
          Reset link accepted. Choose a new password for this account.
        </p>
      )}

      <label className="block">
        <span className="smallcaps text-xs text-ink-soft">New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
        />
      </label>

      <label className="block">
        <span className="smallcaps text-xs text-ink-soft">Confirm password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat the new password"
          className="mt-1 w-full bg-parchment-deep/40 border border-paper-edge rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-sage"
        />
      </label>

      <button
        type="submit"
        disabled={status === "saving"}
        className="w-full bg-sage text-parchment py-2 rounded-sm smallcaps text-sm hover:bg-sage-deep disabled:opacity-60"
      >
        {status === "saving" ? "Saving..." : "Save password"}
      </button>

      {status === "saved" && (
        <p className="text-xs text-sage-deep">
          Password saved. You can now sign in with email and password.
        </p>
      )}
      {errorMsg && <p className="text-burgundy text-xs">{errorMsg}</p>}

      <Link href="/" className="inline-block text-xs smallcaps text-ink-soft hover:text-ink">
        Back home
      </Link>
    </form>
  );
}
