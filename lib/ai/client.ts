import { imageBase64, resizePhoto } from "../diary/images";
import { photoCheck, photoDescription, type AiAction } from "./contracts";

async function request(action: AiAction, file: Blob, token: string, note?: string) {
  const image = await imageBase64(await resizePhoto(file, 1024, 0.74));
  const body = note === undefined ? { image } : { image, note };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 38_000);
  try {
    const result = await fetch("/api/ai/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!result.ok) throw new Error("Gemini is unavailable.");
    return await result.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function checkPhoto(file: Blob, token: string) {
  return photoCheck.parse(await request("check", file, token));
}

export async function describePhoto(file: Blob, token: string, note: string) {
  return photoDescription.parse(await request("describe", file, token, note));
}
