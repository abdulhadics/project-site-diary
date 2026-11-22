"use client";

import { useEffect, useState } from "react";

export function PdfPreview({ file, onEdit, onBack }: {
  file: File; onEdit: () => void; onBack: () => void;
}) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function download() {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
  }

  function share() {
    const data = { files: [file] };
    if (!navigator.share || !navigator.canShare?.(data)) {
      download();
      return;
    }
    void navigator.share(data).catch((error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      download();
      setMessage("Sharing is unavailable. Use Download if the copy did not save.");
    });
  }

  return (
    <section className="flow-section" aria-labelledby="pdf-title">
      <h2 id="pdf-title">Report preview</h2>
      <p className="muted filename">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>
      {url && <div className="actions pdf-actions">
        <a className="button" href={url} target="_blank" rel="noreferrer">Read full PDF</a>
        <button className="button" type="button" onClick={onEdit}>Edit descriptions</button>
        <a className="button" href={url} download={file.name}>Download</a>
        <button className="button primary" type="button" onClick={share}>Share</button>
      </div>}
      {message && <p className="notice warning" role="status">{message}</p>}
      {url && <iframe src={url} title="Daily site progress report PDF" className="pdf-frame" />}
      <button className="text-button" type="button" onClick={onBack}>Back to the diary</button>
    </section>
  );
}
