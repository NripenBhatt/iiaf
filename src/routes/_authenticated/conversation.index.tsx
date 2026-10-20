import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/iiaf/ui";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/conversation/")({
  head: () => pageHead("Conversational Engine", "Start or open a reporting conversation."),
  component: () => <div className="rounded-xl border bg-card p-6 shadow-card"><EmptyState icon={MessagesSquare} title="Start a conversation">Choose “New conversation”, then type or dictate a request such as “Prepare the UGC-REQ-005 draft for 2025-26”.</EmptyState></div>,
});
