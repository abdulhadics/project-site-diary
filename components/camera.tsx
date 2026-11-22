"use client";

import { useEffect, useRef, useState } from "react";
import { cameraFrame, freshLocation, jpeg } from "../lib/diary/images";

export type CameraCapture = {
  blob: Blob;
  capturedAt: string;
  coords: Pick<GeolocationCoordinates, "latitude" | "longitude" | "accuracy">;
};

export function Camera({ onCapture, onCancel }: {
  onCapture: (capture: CameraCapture) => Promise<void>;
  onCancel: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [unwritten, setUnwritten] = useState<CameraCapture | null>(null);

  useEffect(() => {
    let generation = 0;
    let stream: MediaStream | null = null;
    const element = video.current;

    function stop() {
      generation++;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (element) element.srcObject = null;
    }

    async function start() {
      const request = ++generation;
      setReady(false);
      setMessage("");
      try {
        if (!element || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("The live camera needs Safari or Chrome and a secure HTTPS connection.");
        }
        const next = await navigator.mediaDevices.getUserMedia({
          audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        });
        if (request !== generation) {
          next.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = next;
        element.srcObject = next;
        await element.play();
        if (request === generation && element.videoWidth > 0) setReady(true);
        next.getVideoTracks()[0]?.addEventListener("ended", () => {
          if (request !== generation) return;
          setReady(false);
          setMessage("The camera stopped. Tap Restart camera.");
        }, { once: true });
      } catch (error) {
        if (request !== generation) return;
        stop();
        setMessage(error instanceof Error && /secure HTTPS/.test(error.message) ? error.message
          : "Camera access is unavailable. Allow Camera in this site's browser settings, then restart.");
      }
    }

    function visibility() {
      if (document.hidden) {
        stop();
        setReady(false);
      } else {
        void start();
      }
    }

    void start();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      stop();
    };
  }, [retry]);

  async function capture() {
    if (!video.current || pending) return;
    setPending(true);
    setMessage("");
    let canvas: HTMLCanvasElement | undefined;
    let result = unwritten;
    try {
      if (!result) {
        const capturedAt = new Date().toISOString();
        canvas = cameraFrame(video.current);
        const [position, blob] = await Promise.all([freshLocation(), jpeg(canvas, 0.8)]);
        const { latitude, longitude, accuracy } = position.coords;
        result = { blob, capturedAt, coords: { latitude, longitude, accuracy } };
      }
      await onCapture(result);
      setUnwritten(null);
    } catch (error) {
      if (result) {
        setUnwritten(result);
        setMessage("The photo could not be saved on this phone. Free up storage, then retry saving it.");
      } else {
        setMessage(error instanceof Error ? error.message : "The photo could not be captured.");
      }
    } finally {
      if (canvas) canvas.width = canvas.height = 0;
      setPending(false);
    }
  }

  return (
    <section className="flow-section" aria-labelledby="camera-title">
      <h2 id="camera-title">Live camera</h2>
      <video ref={video} className="camera-view" autoPlay playsInline muted
        onCanPlay={() => { if (video.current?.videoWidth) setReady(true); }} aria-label="Live rear camera" />
      {message && <p className="notice warning" role="alert">{message}</p>}
      <div className="actions">
        <button className="button primary" type="button" onClick={capture} disabled={(!ready && !unwritten) || pending}>
          {pending ? "Getting location and saving…" : unwritten ? "Retry saving photo" : "Take photo"}
        </button>
        {!ready && message && !unwritten && <button className="button" type="button" onClick={() => setRetry(retry + 1)}>Restart camera</button>}
        <button className="button" type="button" onClick={onCancel} disabled={pending}>Close camera</button>
      </div>
    </section>
  );
}
