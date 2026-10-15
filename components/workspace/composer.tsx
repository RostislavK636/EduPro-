"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Paperclip, X, Sparkles, FileText } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { useApp } from "../app-context";
export function ChatComposer({
  dashboard = false,
  onSend,
  busy = false,
  initial = "",
}: {
  dashboard?: boolean;
  onSend?: (text: string, attachments: string[]) => Promise<void>;
  busy?: boolean;
  initial?: string;
}) {
  const { navigate, ai } = useApp();
  const [text, setText] = useState(initial);
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (initial) setText(initial);
  }, [initial]);
  const submit = async () => {
    if (!text.trim() || sending || busy) return;
    setSending(true);
    try {
      if (onSend)
        await onSend(
          text,
          files.map((f) => f.id),
        );
      else {
        const chat = await api("chats", "POST", {});
        await api(`chats/${chat.id}/message`, "POST", {
          content: text,
          attachmentIds: files.map((f) => f.id),
        });
        navigate("/chat/" + chat.id);
      }
      setText("");
      setFiles([]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  };
  return (
    <div className={`chat-composer ${dashboard ? "dashboard-composer" : ""}`}>
      <div className="composer-top">
        <span className="composer-spark">
          <Sparkles size={19} />
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={
            dashboard ? "Какая идея у вас сегодня?" : "Спросите EduPilot…"
          }
          aria-label="Сообщение EduPilot"
          maxLength={12000}
          rows={dashboard ? 2 : 2}
        />
      </div>
      {files.length > 0 && (
        <div className="attachment-chips">
          {files.map((f) => (
            <span key={f.id}>
              <FileText size={13} />
              <a href={"/api/files/" + f.id} target="_blank" rel="noreferrer">
                {f.originalName}
              </a>
              <button
                aria-label="Убрать вложение"
                onClick={() => setFiles(files.filter((x) => x.id !== f.id))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="composer-footer">
        <div>
          <input
            ref={input}
            hidden
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.pdf,.docx"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (files.length >= 5) {
                toast.error("Не более 5 вложений");
                return;
              }
              const body = new FormData();
              body.set("file", file);
              setSending(true);
              try {
                const item = await api("files", "POST", body);
                setFiles([...files, item]);
                toast.info(
                  "Файл сохранён. Для анализа используйте инструмент проверки работ.",
                );
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setSending(false);
                e.target.value = "";
              }
            }}
          />
          <button
            className="attach-button"
            aria-label="Прикрепить файл"
            disabled={sending}
            onClick={() => input.current?.click()}
          >
            <Paperclip size={17} />
            <span>Прикрепить файл</span>
          </button>
          <span className="composer-ai">
            {ai?.mode === "live" ? "AI подключён" : "Демо · без анализа файлов"}
          </span>
        </div>
        <button
          className="send-button"
          aria-label="Отправить сообщение"
          disabled={sending || busy || !text.trim()}
          onClick={submit}
        >
          {sending || busy ? (
            <span className="loading-dot" />
          ) : (
            <ArrowUp size={20} />
          )}
        </button>
      </div>
    </div>
  );
}
