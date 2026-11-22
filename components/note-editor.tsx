"use client";

import { useState } from "react";
import { captureTime, descriptionLimit, noteLimit, poorAccuracyMetres, type LocalPhoto } from "../lib/diary/model";
import type { DiaryClient } from "../lib/supabase";
import { PhotoImage } from "./photo-image";

export function NoteEditor({ photo, number, count, client, canUseAi, onSave, onDescribe, onApprove, onDelete, onBack }: {
  photo: LocalPhoto; number: number; count: number; client: DiaryClient; canUseAi: boolean;
  onSave: (change: { note?: string; description?: string }) => Promise<void>;
  onDescribe: (note: string) => Promise<string>;
  onApprove: (description: string) => Promise<void>;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [note, setNote] = useState(photo.row.note);
  const [description, setDescription] = useState(photo.row.description);
  const [busy, setBusy] = useState<"describe" | "approve" | null>(null);
  const [message, setMessage] = useState("");
  const noteCanFit = note.trim().length > 0 && note.trim().length <= descriptionLimit && !/[\u0600-\u06ff]/.test(note);
  const englishCandidate = description.trim() && !/[\u0600-\u06ff]/.test(description);

  async function useNote() {
    const value = note.trim();
    setDescription(value);
    await onSave({ description: value });
  }

  async function describe() {
    setBusy("describe");
    setMessage("");
    try {
      setDescription(await onDescribe(note.trim()));
    } catch {
      setMessage("Gemini is unavailable. Write an English description or use your note if it is already in English.");
      if (!description.trim() && noteCanFit) await useNote().catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (!englishCandidate) return;
    setBusy("approve");
    try {
      await onApprove(description.trim());
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flow-section" aria-labelledby="note-title">
      <h2 id="note-title">Photo {number} of {count}</h2>
      <p className="muted">{captureTime(photo.row.captured_at)}</p>
      <PhotoImage client={client} path={photo.row.storage_path} alt={"Site photo " + number} />
      {photo.row.accuracy > poorAccuracyMetres && <p className="notice warning">Location accuracy is ±{Math.round(photo.row.accuracy)} m.</p>}
      {photo.review === "unavailable" && <p className="muted">Photo check unavailable. Review the image before approving.</p>}
      <div className="form-stack">
        <label>Site note <span className="optional">(English, Urdu or Roman Urdu)</span>
          <textarea rows={2} dir="auto" maxLength={noteLimit} value={note} disabled={Boolean(busy)} onChange={(event) => {
            setNote(event.target.value);
            void onSave({ note: event.target.value }).catch(() => {});
          }} />
        </label>
        <div className="actions">
          <button className="button" type="button" disabled={Boolean(busy) || !canUseAi || !note.trim()} onClick={() => void describe()}>
            {busy === "describe" ? "Writing description…" : "Write with Gemini"}
          </button>
          <button className="button" type="button" disabled={Boolean(busy) || !noteCanFit} onClick={() => void useNote().catch(() => {})}>Use English note</button>
        </div>
        {message && <p className="notice warning" role="status">{message}</p>}
        <label>English description
          <textarea rows={3} maxLength={descriptionLimit} value={description} disabled={Boolean(busy)} onChange={(event) => {
            setDescription(event.target.value);
            void onSave({ description: event.target.value }).catch(() => {});
          }} />
        </label>
        {!canUseAi && <p className="muted">You can write the description yourself.</p>}
        {photo.row.description_approved_at && <p className="muted" role="status">Description approved.</p>}
        <div className="actions">
          <button className="button primary" type="button" disabled={Boolean(busy) || !englishCandidate} onClick={() => void approve().catch(() => {})}>
            {number === count ? "Approve and finish" : "Approve and next"}
          </button>
          <button className="button" type="button" onClick={onBack} disabled={Boolean(busy)}>Back to photos</button>
          <button className="text-button danger" type="button" onClick={onDelete} disabled={Boolean(busy)}>Delete photo</button>
        </div>
      </div>
    </section>
  );
}
