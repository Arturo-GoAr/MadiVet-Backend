"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { FileThumb, useFileDrop } from "@/shared/files";
import { useT } from "@/shared/i18n";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ApiStatus, getApiErrorMessage, requestApi, useApiData } from "@/shared/api";

type ChatAttachment = { id: string; name: string; type: string; url: string };
type ChatMessage = {
  id: string;
  from: "me" | "them";
  text: string;
  at: string;
  files?: ChatAttachment[];
};

export function ChatPanel({ appointmentId }: { appointmentId: string }) {
  const t = useT();
  const { data, loading, error } = useApiData<{ mensajes: ChatMessage[] }>(`appointments/${appointmentId}/messages`);
  const messages = data?.mensajes ?? [];
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const q = (useSearchParams().get("q") ?? "").toLowerCase();
  const { getRootProps, getInputProps, open, isDragActive } = useFileDrop((f) => setFiles((p) => [...p, ...f]));

  const shown = q ? messages.filter((m) => m.text.toLowerCase().includes(q)) : messages;

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text && !files.length) return;
    const formData = new FormData();
    formData.set("text", text);
    files.forEach((file) => formData.append("files", file));
    setSending(true);
    try {
      await requestApi(`appointments/${appointmentId}/messages`, {
        method: "POST",
        body: formData,
      });
      setDraft("");
      setFiles([]);
    } catch (requestError) {
      toast.error(getApiErrorMessage(requestError, t.common.apiError, t.common.schemaNotReady));
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      {...getRootProps()}
      className={cn("flex h-[70dvh] min-h-96 flex-col rounded-xl bg-white shadow-sm", isDragActive && "ring-2 ring-vet-lilac")}
    >
      <input {...getInputProps()} />
      <div ref={list} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {loading || error ? (
          <ApiStatus loading={loading} error={error} />
        ) : shown.length === 0 ? (
          <p className="m-auto text-vet-gray">{q ? t.chat.noMatches : t.chat.empty}</p>
        ) : shown.map((m) => (
          <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-4 py-2", m.from === "me" ? "self-end bg-vet-lilac" : "self-start bg-vet-field")}>
            {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
            {!!m.files?.length && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.files.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded bg-white px-2 py-1 text-sm underline"
                  >
                    {file.name}
                  </a>
                ))}
              </div>
            )}
            <p className="mt-1 text-right text-xs text-vet-gray">{format(parseISO(m.at), "HH:mm")}</p>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="grid gap-2 border-t p-3">
        {!!files.length && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative">
                <FileThumb file={f} className="size-16" />
                <button
                  type="button"
                  aria-label={`${t.files.remove}: ${f.name}`}
                  onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-black text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" aria-label={t.files.attach} onClick={open}>
            <Paperclip className="size-5" />
          </Button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.chat.placeholder}
            aria-label={t.chat.placeholder}
            className="h-10 flex-1 rounded-full border-0 bg-vet-field px-4"
          />
          <Button disabled={sending || loading || Boolean(error)} type="submit" size="icon" aria-label={t.chat.send} className="rounded-full bg-vet-teal text-white hover:bg-vet-teal/90">
            <Send className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
