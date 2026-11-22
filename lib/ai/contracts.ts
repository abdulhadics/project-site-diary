import { z } from "zod";
import { descriptionLimit, noteLimit } from "../diary/model";

export const photoCheck = z.strictObject({
  photo_ok: z.boolean(),
  reason: z.string().trim().min(1).max(140),
});

export const photoDescription = z.strictObject({
  description: z.string().trim().min(1).max(descriptionLimit),
});

const image = z.string().min(16).max(720_000).regex(/^\/9j\/[A-Za-z0-9+/=]+$/);
export const checkInput = z.strictObject({ image });
export const descriptionInput = z.strictObject({ image, note: z.string().trim().min(1).max(noteLimit) });
export type AiAction = "check" | "describe";

export const responseSchema = {
  check: {
    type: "object",
    properties: { photo_ok: { type: "boolean" }, reason: { type: "string" } },
    required: ["photo_ok", "reason"],
    additionalProperties: false,
  },
  describe: {
    type: "object",
    properties: { description: { type: "string" } },
    required: ["description"],
    additionalProperties: false,
  },
} as const;
