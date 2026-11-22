"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { DiaryClient } from "../lib/supabase";
import { changeDiary, readDiary } from "../lib/diary/local";
import { classifyCloudIssue, syncDiary, type SyncIssue } from "../lib/diary/cloud";
import { waiting, type Diary } from "../lib/diary/model";

export function useDiary(owner: string, client: DiaryClient, session: Session | null) {
  const [diary, setDiary] = useState<Diary | null>(null);
  const [localError, setLocalError] = useState("");
  const [issue, setIssue] = useState<SyncIssue | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [checkedCloud, setCheckedCloud] = useState(false);
  const sessionRef = useRef(session);
  const busy = useRef(false);
  const initialized = useRef(false);
  sessionRef.current = session;

  useEffect(() => {
    let active = true;
    readDiary(owner).then((snapshot) => {
      if (!active) return;
      if (Object.values(snapshot.photos).some((photo) => photo.review === "checking")) {
        return changeDiary(owner, (stored) => {
          for (const photo of Object.values(stored.photos)) {
            if (photo.review === "checking") {
              photo.review = "unavailable";
              photo.reason = "The photo check was interrupted.";
            }
          }
        }).then((updated) => { if (active) setDiary(updated); });
      }
      setDiary(snapshot);
    }).catch(() => {
      if (active) setLocalError("This browser could not open the local diary. Try opening the app in Safari or Chrome.");
    });
    return () => { active = false; };
  }, [owner]);

  const save = useCallback(async (mutation: Parameters<typeof changeDiary>[1]) => {
    try {
      const saved = await changeDiary(owner, mutation);
      setDiary(saved);
      setLocalError("");
      return saved;
    } catch (error) {
      setLocalError("The phone could not save this change. Check available browser storage and try again.");
      throw error;
    }
  }, [owner]);

  const retry = useCallback(async (refresh = true) => {
    if (busy.current) return;
    if (!navigator.onLine) {
      setIssue("offline");
      setCheckedCloud(true);
      return;
    }
    if (!sessionRef.current || sessionRef.current.user.id !== owner) {
      setIssue("login");
      setCheckedCloud(true);
      return;
    }
    busy.current = true;
    setSyncing(true);
    try {
      await syncDiary(client, owner, refresh, setDiary);
      setIssue(null);
    } catch (error) {
      setIssue(classifyCloudIssue(error));
    } finally {
      busy.current = false;
      setSyncing(false);
      setCheckedCloud(true);
    }
  }, [client, owner]);

  useEffect(() => {
    if (!diary || initialized.current) return;
    initialized.current = true;
    void retry();
  }, [diary, retry]);

  const hasSession = Boolean(session);
  useEffect(() => {
    if (hasSession && initialized.current && issue === "login") void retry();
  }, [hasSession, issue, retry]);

  useEffect(() => {
    if (!diary || !waiting(diary) || issue || syncing) return;
    const timer = setTimeout(() => void retry(false), 350);
    return () => clearTimeout(timer);
  }, [diary, issue, syncing, retry]);

  useEffect(() => {
    function foreground() {
      if (document.visibilityState === "visible" && (issue || (diary && waiting(diary)))) void retry();
    }
    function online() { void retry(); }
    function offline() { setIssue("offline"); }
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", foreground);
    const timer = setInterval(foreground, 45_000);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", foreground);
      clearInterval(timer);
    };
  }, [diary, issue, retry]);

  return { diary, save, retry, issue, syncing, localError, checkedCloud };
}
