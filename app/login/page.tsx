import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="text-center mb-8">
        <p className="smallcaps text-xs text-ink-soft mb-2">private cellar</p>
        <h1 className="font-serif text-4xl text-ink">Sign in</h1>
        <p className="text-sm text-ink-soft mt-2">
          We&apos;ll email you a one-click magic link. No passwords, no signup form — your account
          is created the first time you sign in.
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
