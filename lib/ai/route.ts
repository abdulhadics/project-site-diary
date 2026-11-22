import "server-only";
import { createDiaryClient } from "../supabase";
import { checkInput, descriptionInput, type AiAction } from "./contracts";
import { invokeGemini } from "./gemini";

export async function handleAi(request: Request, action: AiAction): Promise<Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return Response.json({ error: "Sign in to use Gemini." }, { status: 401 });
  const supabase = createDiaryClient(true);
  if (!supabase) return Response.json({ error: "Authentication is unavailable." }, { status: 503 });
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims.sub || data.claims.role !== "authenticated") {
      return Response.json({ error: "Sign in again to use Gemini." }, { status: 401 });
    }
  } catch {
    return Response.json({ error: "Authentication is unavailable." }, { status: 503 });
  }
  const schema = action === "check" ? checkInput : descriptionInput;
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "The image or note is invalid." }, { status: 400 });
  try {
    return Response.json(await invokeGemini(action, input.data));
  } catch {
    return Response.json({ error: "Gemini is unavailable. Continue with your own description." }, { status: 503 });
  }
}
