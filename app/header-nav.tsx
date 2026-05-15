"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

type Props = {
  signedIn: boolean;
  isOwner: boolean;
};

export function HeaderNav({ signedIn, isOwner }: Props) {
  const [open, setOpen] = useState(false);
  const closeDrawer = () => setOpen(false);

  // lock body scroll while the drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = (
    <>
      <Link href="/cocktails" onClick={closeDrawer} className="hover:text-ink whitespace-nowrap">
        Cocktails
      </Link>
      <Link href="/botanicals" onClick={closeDrawer} className="hover:text-ink whitespace-nowrap">
        Botanicals
      </Link>
      <Link href="/calculator" onClick={closeDrawer} className="hover:text-ink whitespace-nowrap">
        Calculator
      </Link>
      {signedIn && (
        <>
          <Link href="/bar" onClick={closeDrawer} className="hover:text-ink whitespace-nowrap">
            My Bar
          </Link>
          <Link href="/favorites" onClick={closeDrawer} className="hover:text-ink whitespace-nowrap">
            Notebook
          </Link>
          {isOwner && (
            <Link href="/library" onClick={closeDrawer} className="hover:text-ink text-burgundy whitespace-nowrap">
              Library
            </Link>
          )}
        </>
      )}
    </>
  );

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-5 text-sm text-ink-soft">
        {links}
        {signedIn ? (
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="hover:text-ink underline-offset-4 hover:underline"
            >
              Sign out
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            onClick={closeDrawer}
            className="rounded-full border border-sage/60 text-sage-deep px-3 py-1 hover:bg-sage/10"
          >
            Sign in
          </Link>
        )}
      </nav>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-drawer"
        aria-label={open ? "Close menu" : "Open menu"}
        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-sm border border-paper-edge text-ink-soft hover:text-ink"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
          {open ? (
            <path
              d="M4 4l12 12M16 4L4 16"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <>
              <line x1="3" y1="6" x2="17" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="3" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile drawer */}
      {open && (
        <div
          id="mobile-drawer"
          className="md:hidden fixed inset-x-0 top-[64px] bottom-0 bg-parchment z-40 border-t border-paper-edge/70 overflow-y-auto"
        >
          <nav className="flex flex-col px-6 py-6 gap-4 text-lg font-serif text-ink">
            {links}
            <div className="divider-rule my-2" />
            {signedIn ? (
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-base text-ink-soft hover:text-ink underline-offset-4 hover:underline"
                >
                  Sign out
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                onClick={closeDrawer}
                className="self-start rounded-full border border-sage/60 text-sage-deep px-4 py-1.5 text-sm hover:bg-sage/10"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
