import { createFileRoute } from "@tanstack/react-router";
import { handleTranscribe } from "@/lib/assistant.server";

export const Route = createFileRoute("/api/transcribe")({
  server: { handlers: { POST: ({ request }) => handleTranscribe(request) } },
});
