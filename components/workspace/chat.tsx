"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Paperclip,
  X,
  Sparkles,
  Copy,
  RotateCcw,
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Pencil,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { useApp } from "../app-context";
import { AnimatedPage, EmptyState, GlassCard } from "../ui/edupilot";
import "katex/dist/katex.min.css";
import { ChatComposer } from "./composer";
export function ChatMessage({ message }: { message: any }) {
  const { user } = useApp();
  return (
    <article className={"chat-message " + message.role}>
      <div className="message-avatar">
        {message.role === "user" ? user.firstName[0] : <Sparkles size={16} />}
      </div>
      <div className="message-content">
        <div className="message-author">
          {message.role === "user" ? user.firstName : "EduPilot"}
          {message.demo && <span>Демонстрационный ответ</span>}
        </div>
        <div className="markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeHighlight]}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        {message.role === "assistant" && (
          <button
            className="text-button"
            onClick={() =>
              navigator.clipboard
                .writeText(message.content)
                .then(() => toast.success("Ответ скопирован"))
                .catch(() => toast.error("Буфер обмена недоступен"))
            }
          >
            <Copy size={13} />
            Копировать
          </button>
        )}
      </div>
    </article>
  );
}
export function ChatPage({ id }: { id?: string }) {
  const { navigate } = useApp();
  const query = useSearchParams();
  const [chat, setChat] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const load = async () => {
    setError("");
    try {
      setHistory(await api("chats"));
      if (id && id !== "history") setChat(await api("chats/" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, [id]);
  useEffect(() => {
    end.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [chat?.messages?.length, busy]);
  const send = async (
    text: string,
    attachments: string[],
    regenerate = false,
  ) => {
    setBusy(true);
    try {
      let active =
        id && id !== "history" ? id : (await api("chats", "POST", {})).id;
      await api(`chats/${active}/message`, "POST", {
        content: text,
        attachmentIds: attachments,
        regenerate,
      });
      if (active !== id) navigate("/chat/" + active);
      else await load();
    } finally {
      setBusy(false);
    }
  };
  return (
    <AnimatedPage>
      <div className="chat-layout">
        <aside className="chat-history">
          <div className="section-heading">
            <h2>Диалоги</h2>
            <button
              className="icon-button"
              aria-label="Новый диалог"
              onClick={() => navigate("/chat")}
            >
              <Plus size={18} />
            </button>
          </div>
          <label className="search-field">
            <Search size={15} />
            <input
              placeholder="Поиск диалогов"
              aria-label="Поиск диалогов"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {history
            .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
            .map((c) => (
              <div
                className={"history-item " + (c.id === id ? "active" : "")}
                key={c.id}
              >
                <button onClick={() => navigate("/chat/" + c.id)}>
                  <MessageSquare size={14} />
                  <span>{c.title}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label="Переименовать диалог"
                  onClick={async () => {
                    const title = prompt("Название диалога", c.title);
                    if (title?.trim())
                      try {
                        await api("chats/" + c.id, "PATCH", { title });
                        load();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                  }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Удалить диалог"
                  onClick={async () => {
                    if (confirm("Удалить этот диалог и все сообщения?"))
                      try {
                        await api("chats/" + c.id, "DELETE");
                        if (id === c.id) navigate("/chat");
                        else load();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          {!history.length && (
            <p className="muted small">Ваш первый диалог появится здесь.</p>
          )}
        </aside>
        <section className="chat-main">
          <header className="chat-header">
            <div>
              <span className="eyebrow">ВАШ ПАРТНЁР В ОБУЧЕНИИ</span>
              <h1>{chat?.title || "Давайте разберёмся вместе"}</h1>
            </div>
            <Sparkles size={24} />
          </header>
          <div className="messages-scroll">
            {error ? (
              <p role="alert" className="form-error">
                {error}
                <button className="button secondary" onClick={load}>
                  Повторить
                </button>
              </p>
            ) : !chat?.messages?.length ? (
              <EmptyState
                icon={<Sparkles size={32} />}
                title="Любопытство — начало открытия"
                description="Задайте вопрос, попросите объяснить тему или обсудите идею нового урока."
              />
            ) : (
              chat.messages.map((m: any) => (
                <ChatMessage key={m.id} message={m} />
              ))
            )}
            {busy && (
              <div className="thinking" aria-label="Ожидание ответа">
                <i />
                <i />
                <i />
                <span>EduPilot готовит ответ…</span>
              </div>
            )}
            <div ref={end} />
          </div>
          {chat?.messages?.some((m: any) => m.role === "user") && (
            <button
              className="text-button regenerate"
              disabled={busy}
              onClick={() =>
                send(
                  [...chat.messages]
                    .reverse()
                    .find((m: any) => m.role === "user").content,
                  [],
                  true,
                ).catch((e) => toast.error(e.message))
              }
            >
              <RotateCcw size={13} />
              Повторить ответ
            </button>
          )}
          <ChatComposer
            initial={query.get("prompt") || ""}
            onSend={send}
            busy={busy}
          />
          <p className="chat-disclaimer">
            {chat?.messages?.some((m: any) => m.demo)
              ? "Демо-ответы — учебные примеры. Они не анализируют ваши материалы."
              : "Проверяйте важные факты и результаты перед использованием."}
          </p>
        </section>
      </div>
    </AnimatedPage>
  );
}
