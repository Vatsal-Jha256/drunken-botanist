import { LoginForm } from "./login-form";

function safeNextPath(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

type SP = Promise<{ next?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="text-center mb-8">
        <p className="smallcaps text-xs text-ink-soft mb-2">private cellar</p>
        <h1 className="font-serif text-4xl text-ink">Sign in</h1>
        <p className="text-sm text-ink-soft mt-2">
          Use email and password for the free-tier setup. It avoids magic-link email limits when
          Supabase email confirmation is turned off.
        </p>
      </div>
      <LoginForm nextPath={safeNextPath(sp.next)} />
    </div>
  );
}
