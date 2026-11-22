"use client";

import { useEffect, useState, type FormEvent } from "react";
import { cloudBytes } from "../lib/diary/cloud";
import type { Project } from "../lib/diary/model";
import type { DiaryClient } from "../lib/supabase";

export function Login({ signIn, onDone, onCancel }: {
  signIn: (email: string, password: string) => Promise<string | null>;
  onDone?: () => void;
  onCancel?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const error = await signIn(String(form.get("email")).trim(), String(form.get("password")));
      if (error) setMessage(error);
      else onDone?.();
    } catch {
      setMessage("Sign-in is unavailable. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flow-section account" aria-labelledby="login-title">
      <h1 id="login-title">Sign in</h1>
      <form className="form-stack" onSubmit={submit}>
        <label>Email<input name="email" type="email" required autoComplete="username" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
        {message && <p className="notice warning" role="alert">{message}</p>}
        <div className="actions">
          <button className="button primary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
          {onCancel && <button className="button" type="button" onClick={onCancel}>Keep working locally</button>}
        </div>
      </form>
    </section>
  );
}

type ProjectFields = Pick<Project, "name" | "company_name" | "prepared_by">;

export function Settings({ project, save, signOut, client, online, syncing }: {
  project: Project | null;
  save: (fields: ProjectFields) => Promise<void>;
  signOut: () => Promise<void>;
  client: DiaryClient;
  online: boolean;
  syncing: boolean;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    if (!online || syncing) return;
    let active = true;
    cloudBytes(client).then((size) => { if (active) setBytes(size); }).catch(() => {});
    return () => { active = false; };
  }, [client, online, syncing]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    if (!name) return;
    setBusy(true);
    setSubmitted(false);
    try {
      await save({
        name, company_name: String(form.get("company")).trim() || null,
        prepared_by: String(form.get("prepared")).trim() || null,
      });
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flow-section" aria-labelledby="settings-title">
      <h1 id="settings-title">{project ? "Settings" : "Set up your project"}</h1>
      <form className="form-stack" onSubmit={(event) => { void submit(event).catch(() => {}); }}>
        <label>Project name<input name="name" maxLength={64} required defaultValue={project?.name} /></label>
        <label>Employer or company <span className="optional">(optional)</span><input name="company" maxLength={60} defaultValue={project?.company_name ?? ""} /></label>
        <label>Prepared by <span className="optional">(optional)</span><input name="prepared" maxLength={60} defaultValue={project?.prepared_by ?? ""} /></label>
        {submitted && <p className="muted" role="status">Settings saved on this phone.</p>}
        <div className="actions">
          <button className="button primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </form>
      <div className="settings-foot">
        <div>
          <h2>Cloud storage used</h2>
          <p>{bytes === null ? "Available after cloud sync." : (bytes / 1024 / 1024).toFixed(2) + " MB"}</p>
        </div>
        <button className="button" onClick={() => void signOut()} type="button">Sign out</button>
      </div>
    </section>
  );
}
