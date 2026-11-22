import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type DiaryClient = SupabaseClient<Database>;

const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const signal = init?.signal ?? (input instanceof Request ? input.signal : null);
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 25_000);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
};

export function createDiaryClient(server = false): DiaryClient | null {
  if (!supabaseUrl || !publishableKey) return null;
  return createClient<Database>(supabaseUrl, publishableKey, {
    global: { fetch: fetchWithTimeout },
    ...(server ? { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } } : {}),
  });
}
