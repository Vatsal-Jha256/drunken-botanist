import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

type SP = Promise<{ reset?: string }>;

export default async function PasswordPage({ searchParams }: { searchParams: SP }) {
  const [user, sp] = await Promise.all([getUser(), searchParams]);
  if (!user) redirect("/login?next=/account/password");

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="text-center mb-8">
        <p className="smallcaps text-xs text-ink-soft mb-2">account</p>
        <h1 className="font-serif text-4xl text-ink">Password</h1>
        <p className="text-sm text-ink-soft mt-2">
          Set a password for an old magic-link account, or change the password on this account.
        </p>
      </div>
      <PasswordForm email={user.email ?? "signed-in account"} resetMode={sp.reset === "1"} />
    </div>
  );
}
