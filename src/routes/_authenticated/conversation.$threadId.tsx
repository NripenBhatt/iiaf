import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { createParser } from "eventsource-parser";
import { Mic, RotateCcw, Square, X } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/components/iiaf/workspace";
import { Status } from "@/components/iiaf/ui";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputButton, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { PackageDownloads } from "@/components/iiaf/package-actions";
import { getThread } from "@/lib/assistant.functions";
import { recordWav } from "@/lib/record-wav";
import type { PackageContent } from "@/lib/package-format";
import mark from "@/assets/iiaf-engine-mark.png";

export const Route = createFileRoute("/_authenticated/conversation/$threadId")({
  head: () => pageHead("Conversation", "Reporting conversation with the IIAF Conversational Engine."),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const get = useServerFn(getThread);
  const { data, isLoading, error } = useQuery({ queryKey: ["thread", threadId], queryFn: () => get({ data: { threadId } }), staleTime: Infinity });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading conversation…</p>;
  if (error || !data) return <p className="text-sm text-destructive">This conversation is not available to you.</p>;
  return <Chat key={threadId} threadId={threadId} initial={data.messages as unknown as UIMessage[]} />;
}

const EXAMPLES = ["Which agency requirements are imported?", "Show the evidence for UGC-REQ-005 for 2025-26", "Which required fields are still missing for UGC-REQ-005?", "Generate the UGC-REQ-005 draft package for 2025-26"];
const TOOL_LABEL: Record<string, string> = { search_requirements: "Searched imported requirements", get_requirement_evidence: "Retrieved requirement evidence", generate_draft_package: "Generated draft package", get_package_history: "Read package history", get_import_status: "Checked import gate" };

function Chat({ threadId, initial }: { threadId: string; initial: UIMessage[] }) {
  const { workspace } = useWorkspace(); const cache = useQueryClient();
  const [text, setText] = useState(""); const area = useRef<HTMLTextAreaElement>(null);
  const { messages, sendMessage, status, stop, error } = useChat({
    id: threadId, messages: initial,
    transport: new DefaultChatTransport({ api: "/api/assistant", body: { threadId, organizationId: workspace.id }, headers: async (): Promise<Record<string, string>> => { const { data } = await supabase.auth.getSession(); return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}; } }),
    onError: (e) => toast.error(e.message || "The assistant is unavailable."),
    onFinish: () => { void cache.invalidateQueries({ queryKey: ["threads", workspace.id] }); },
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => { if (!busy) area.current?.focus(); }, [busy, threadId]);
  function submit(value: string) { const v = value.trim(); if (!v || busy) return; void sendMessage({ text: v }); setText(""); }

  return <div className="flex h-[calc(100vh-15rem)] min-h-[520px] flex-col rounded-xl border bg-card shadow-card">
    <Conversation className="flex-1">
      <ConversationContent>
        {messages.length === 0 && <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
          <img src={mark} alt="IIAF Conversational Engine" width={64} height={64} className="mx-auto size-16" />
          <p className="text-sm text-muted-foreground">Ask about imported requirements, evidence, gaps or packages. You can type or use the microphone; you will see and can edit the transcript before sending.</p>
          <div className="flex flex-wrap justify-center gap-2">{EXAMPLES.map(e => <Button key={e} size="sm" variant="outline" onClick={() => setText(e)}>{e}</Button>)}</div>
        </div>}
        {messages.map(m => <Message key={m.id} from={m.role}>
          <MessageContent className={m.role === "user" ? "bg-primary text-primary-foreground" : "bg-transparent"}>
            {m.parts.map((p, i) => {
              if (p.type === "text") return m.role === "user" ? <p key={i} className="whitespace-pre-wrap">{p.text}</p> : <MessageResponse key={i}>{p.text}</MessageResponse>;
              if (p.type.startsWith("tool-")) { const t = p as Extract<UIMessage["parts"][number], { type: `tool-${string}` }> & { input?: unknown; output?: unknown; errorText?: string; state: never };
                const name = p.type.slice(5);
                return <div key={i}>
                  <Tool defaultOpen={false}><ToolHeader type={t.type} state={t.state} title={TOOL_LABEL[name] ?? name} /><ToolContent><ToolInput input={t.input} /><ToolOutput output={t.output as never} errorText={t.errorText} /></ToolContent></Tool>
                  {name === "generate_draft_package" && t.output ? <PackageCard out={t.output as PackageOut} /> : null}
                </div>; }
              return null;
            })}
          </MessageContent>
        </Message>)}
        {status === "submitted" && <Message from="assistant"><MessageContent className="bg-transparent"><Shimmer>Retrieving authorised records…</Shimmer></MessageContent></Message>}
        {error && <p role="alert" className="text-sm text-destructive">Request failed: {error.message}. Your text is preserved; edit and send again.</p>}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
    <div className="border-t p-3">
      <PromptInput onSubmit={() => submit(text)}>
        <PromptInputTextarea ref={area} value={text} onChange={e => setText(e.target.value)} placeholder="Type a request, or dictate with the microphone, then review the text before sending…" aria-label="Request" />
        <PromptInputFooter>
          <PromptInputTools><Dictation organizationId={workspace.id} onText={t => { setText(prev => (prev ? prev + " " : "") + t); area.current?.focus(); }} /></PromptInputTools>
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
        </PromptInputFooter>
      </PromptInput>
      <p className="mt-1 text-[11px] text-muted-foreground">Answers distinguish retrieved records, interpretation and missing information. Approvals, held-record decisions, imports and certification stay in their review screens.</p>
    </div>
  </div>;
}

type PackageOut = { packageId: string; version: number; unchanged: boolean; sha256: string; requirementId: string; recordId: string; period: string; populatedFields: number; totalFields: number; evidenceItems: number; issueCount: number };
function PackageCard({ out }: { out: PackageOut }) {
  const { workspace } = useWorkspace();
  const { data } = useQuery({ queryKey: ["pkg", out.packageId], queryFn: async () => (await supabase.from("evidence_packages").select("content,version,content_sha256,generated_at,status").eq("id", out.packageId).eq("organization_id", workspace.id).maybeSingle()).data });
  return <div className="mb-3 space-y-2 rounded-md border border-gold/50 bg-gold-soft/40 p-3 text-xs">
    <p className="font-medium">{out.requirementId} · {out.period} · version {out.version} {out.unchanged ? "(content unchanged — version kept)" : "(new version)"} <Status tone={data?.status === "reviewed" ? "success" : data?.status === "superseded" ? "neutral" : "gold"}>{data?.status === "superseded" ? "Superseded" : "DRAFT · not certified"}</Status></p>
    <p>{out.populatedFields}/{out.totalFields} fields populated · {out.evidenceItems} evidence items · {out.issueCount} issues</p>
    <p className="break-all font-mono text-[10px] text-muted-foreground">SHA-256 {out.sha256}</p>
    {data && <PackageDownloads content={data.content as unknown as PackageContent} meta={{ version: data.version, sha256: data.content_sha256, generatedAt: new Date(data.generated_at).toISOString(), status: data.status }} baseName={`IIAF_${out.requirementId}_${out.period}`} />}
    <Link to="/agency-requirements" className="text-primary underline">Open in Agency Requirement Explorer for review</Link>
  </div>;
}

type MicState = "idle" | "recording" | "processing";
function Dictation({ organizationId, onText }: { organizationId: string; onText: (t: string) => void }) {
  const [state, setState] = useState<MicState>("idle"); const [last, setLast] = useState<File | null>(null); const [partial, setPartial] = useState("");
  const rec = useRef<{ stop: () => Promise<File> } | null>(null); const abort = useRef<AbortController | null>(null);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== "undefined";
  async function start() {
    if (!supported) { toast.error("This browser cannot record audio. Please type your request."); return; }
    try { rec.current = await recordWav(); setState("recording"); }
    catch (e) { const n = (e as DOMException)?.name; toast.error(n === "NotAllowedError" ? "Microphone permission was denied. Allow it in the browser’s site settings, or type instead." : n === "NotFoundError" ? "No microphone was found. Please type your request." : "The microphone could not be started."); setState("idle"); }
  }
  async function finish(cancel = false) {
    const r = rec.current; rec.current = null; if (!r) return;
    let file: File; try { file = await r.stop(); } catch (e) { setState("idle"); if (!cancel) toast.error(e instanceof Error ? e.message : "Recording failed"); return; }
    if (cancel) { setState("idle"); return; }
    setLast(file); await send(file);
  }
  async function send(file: File) {
    setState("processing"); setPartial(""); abort.current = new AbortController();
    try {
      const { data } = await supabase.auth.getSession();
      const form = new FormData(); form.append("file", file); form.append("organizationId", organizationId);
      const res = await fetch("/api/transcribe", { method: "POST", body: form, headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}, signal: abort.current.signal });
      if (!res.ok || !res.body) { const j = await res.json().catch(() => null) as { error?: string | { message?: string } } | null; const m = typeof j?.error === "string" ? j.error : j?.error?.message; throw new Error(res.status === 402 ? "AI credits are exhausted." : res.status === 429 ? "Transcription is busy; retry shortly." : m || "Transcription failed."); }
      let final = ""; let acc = "";
      const parser = createParser({ onEvent: ev => { try { const d = JSON.parse(ev.data); if (d.type === "transcript.text.delta") { acc += d.delta; setPartial(acc); } if (d.type === "transcript.text.done") final = d.text; if (d.type === "error") throw new Error(d.error?.message ?? "Transcription failed"); } catch (err) { if (err instanceof Error && err.message !== "Unexpected end of JSON input") throw err; } } });
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) { const { done, value } = await reader.read(); if (done) break; parser.feed(value); }
      const t = (final || acc).trim();
      if (!t) throw new Error("No speech was recognised. Try again closer to the microphone, or type.");
      onText(t); setLast(null); toast.success("Transcript added — review and edit it before sending.");
    } catch (e) { if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Transcription failed"); }
    finally { setState("idle"); setPartial(""); }
  }
  if (state === "recording") return <div className="flex items-center gap-1"><span className="flex items-center gap-1 text-xs text-destructive" role="status"><span className="size-2 animate-pulse rounded-full bg-destructive" /> Recording</span>
    <PromptInputButton onClick={() => void finish()} aria-label="Stop and transcribe"><Square /> Stop</PromptInputButton><PromptInputButton onClick={() => void finish(true)} aria-label="Cancel recording"><X /></PromptInputButton></div>;
  if (state === "processing") return <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><Shimmer>{partial ? `Transcribing: ${partial.slice(-60)}` : "Transcribing…"}</Shimmer><PromptInputButton onClick={() => abort.current?.abort()} aria-label="Cancel transcription"><X /></PromptInputButton></div>;
  return <div className="flex items-center gap-1">
    <PromptInputButton onClick={() => void start()} aria-label="Dictate request" disabled={!supported} title={supported ? "Dictate (English)" : "Recording is not supported in this browser"}><Mic /> Dictate</PromptInputButton>
    {last && <PromptInputButton onClick={() => void send(last)} aria-label="Retry transcription"><RotateCcw /> Retry</PromptInputButton>}
  </div>;
}
