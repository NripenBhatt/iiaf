import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, SendHorizontal } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { EmptyState, InternalOnly, PageHeader, PlaceholderNotice } from "@/components/iiaf/ui";

export const Route = createFileRoute("/conversation")({
  head: () => pageHead("Conversational Engine", "Ask cited questions across permitted institutional records."),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Intelligence · Internal"
        title="Conversational Engine"
        description="Ask questions across permitted records with citations. It does not approve evidence, certify, sign, publish or submit."
      />
      <InternalOnly>
        <PlaceholderNotice>No AI is connected. Questions cannot be sent and no answers are produced.</PlaceholderNotice>
        <div className="flex min-h-[420px] flex-col rounded-xl border bg-card shadow-card">
          <div className="flex-1 p-6">
            <EmptyState icon={MessagesSquare} title="No conversation yet">
              Example questions for later: “Which NAAC 3.2 metrics lack verified evidence?” or “Show council decisions with overdue actions.”
            </EmptyState>
          </div>
          <div className="flex gap-2 border-t p-4">
            <input disabled placeholder="Conversational Engine is not available in Phase 0" className="flex-1 cursor-not-allowed rounded-md border bg-muted px-3 py-2 text-sm" />
            <button disabled aria-label="Send (disabled)" className="cursor-not-allowed rounded-md bg-muted px-3 text-muted-foreground">
              <SendHorizontal className="size-4" />
            </button>
          </div>
        </div>
      </InternalOnly>
    </>
  );
}
