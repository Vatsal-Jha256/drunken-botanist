"use client";

import { useEffect, useState } from "react";
import { HeaderNav } from "./header-nav";

type SessionState = {
  signedIn: boolean;
  isOwner: boolean;
};

const anonymousSession: SessionState = {
  signedIn: false,
  isOwner: false,
};

export function HeaderNavSession() {
  const [session, setSession] = useState<SessionState>(anonymousSession);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: SessionState | null) => {
        if (!cancelled && data) {
          setSession({
            signedIn: Boolean(data.signedIn),
            isOwner: Boolean(data.isOwner),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSession(anonymousSession);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <HeaderNav signedIn={session.signedIn} isOwner={session.isOwner} />;
}
