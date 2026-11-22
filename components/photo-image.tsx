"use client";

import { useEffect, useState } from "react";
import type { DiaryClient } from "../lib/supabase";
import { getAsset } from "../lib/diary/cloud";

export function PhotoImage({ client, path, alt, className }: {
  client: DiaryClient; path: string; alt: string; className?: string;
}) {
  const [state, setState] = useState<{ url?: string; failed?: boolean }>({});
  useEffect(() => {
    let active = true;
    let url: string | undefined;
    getAsset(client, path).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setState({ url });
    }).catch(() => { if (active) setState({ failed: true }); });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, path]);

  if (!state.url) return <div className="photo-placeholder">{state.failed ? "Photo unavailable on this device." : "Loading photo…"}</div>;
  /* Local and signed images stay outside the Next.js image proxy. */
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className ?? "site-photo"} src={state.url} alt={alt} />;
}
