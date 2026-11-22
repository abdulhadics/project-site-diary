import { handleAi } from "../../../../lib/ai/route";

export const maxDuration = 50;

export function POST(request: Request) {
  return handleAi(request, "check");
}
