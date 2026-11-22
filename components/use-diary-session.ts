"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseUrl, type DiaryClient } from "../lib/supabase";

const ownerKey = "site-diary-owner:" + supabaseUrl;
const locked = "signed-out";

function cachedOwner(): string | null {
  try { return localStorage.getItem(ownerKey); } catch { return null; }
}

function remember(value: string) {
  try { localStorage.setItem(ownerKey, value); } catch { /* The current session can still work. */ }
}

export function useDiarySession(client: DiaryClient | null) {
  const [auth, setAuth] = useState<{ ready: boolean; owner: string | null; session: Session | null }>({
    ready: false, owner: null, session: null,
  });

  useEffect(() => {
    if (!client) return;
    const remembered = cachedOwner();
    if (remembered && remembered !== locked) {
      setAuth({ ready: true, owner: remembered, session: null });
    }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const current = cachedOwner();
      if (current === locked) {
        setAuth({ ready: true, owner: null, session: null });
      } else if (session) {
        remember(session.user.id);
        setAuth({ ready: true, owner: session.user.id, session });
      } else {
        setAuth({ ready: true, owner: current, session: null });
      }
    });
    return () => subscription.unsubscribe();
  }, [client]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client) return "Sign-in is unavailable.";
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      if (!navigator.onLine) return "Connect to the internet to sign in.";
      if (!error?.status || error.status >= 500) return "Sign-in is unavailable. Try again when the cloud project is reachable.";
      return "Sign-in failed. Check your email and password.";
    }
    remember(data.session.user.id);
    setAuth({ ready: true, owner: data.session.user.id, session: data.session });
    return null;
  }, [client]);

  const signOut = useCallback(async () => {
    remember(locked);
    setAuth({ ready: true, owner: null, session: null });
    await client?.auth.signOut({ scope: "local" }).catch(() => {});
  }, [client]);

  return { ...auth, signIn, signOut };
}
