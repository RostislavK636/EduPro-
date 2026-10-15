"use client";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Copy,
  Download,
  Printer,
  FileText,
  Search,
  FolderOpen,
  Save,
  Sparkles,
  Presentation,
  Play,
  Volume2,
  Upload,
  Check,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import { slidePalette } from "@/lib/slide-theme";
import {
  subjects,
  toolNames,
  toolTypes,
  ToolType,
  MaterialRecord,
  GeneratorInput,
  generatorSchema,
  Section,
} from "@/lib/domain";
import { useApp } from "../app-context";
import {
  Field,
  GradientButton,
  GlassCard,
  ToolPageLayout,
  AnimatedPage,
  EmptyState,
} from "../ui/edupilot";
const hints: Record<ToolType, string> = {
  lesson:
    "Продумайте каждый этап занятия — от первого вопроса до нового открытия.",
  worksheet: "Соберите задания, которые помогут закрепить знания на практике.",
  test: "Создайте варианты, настройте баллы и сохраните ключи ответов отдельно.",
  presentation:
    "Превратите тему в наглядную историю. Редактируемые слайды 16:9.",
  video: "Подготовьте сценарий, сцены и текст озвучивания вашего занятия.",
  review: "Загрузите работу, оцените по критериям и сохраните отчёт.",
  notes: "Выделите главное и соберите знания в понятную структуру.",
};
const questionTypes = [
  "Открытый вопрос",
  "Тест с выбором ответа",
  "Заполнение пропусков",
  "Соответствия",
  "Последовательность",
  "Практическая задача",
  "Работа с текстом",
];
export function ToolPage({ type }: { type: ToolType }) {
  const { user, ai, navigate } = useApp();
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [manualScore, setManualScore] = useState("");
  const [comment, setComment] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<GeneratorInput>({
    resolver: zodResolver(generatorSchema) as any,
    defaultValues: {
      type: toolTypes.includes(type) ? type : "lesson",
      title: "",
      subject: user.settings?.preferredSubject || "Математика",
      grade: user.settings?.preferredGrade || 7,
      duration: 45,
      count: 6,
      variants: 1,
      maxScore: 10,
      difficulty: "Средний",
      lessonType: "Изучение нового материала",
      goals: "",
      results: "",
      equipment: "",
      instructions: "",
      answerSheet: true,
      questionTypes: ["Открытый вопрос"],
      style: "Космос",
      language: "Русский",
    },
  });
  if (!toolTypes.includes(type))
    return (
      <EmptyState
        icon={<FileText />}
        title="Инструмент не найден"
        description="Выберите инструмент в меню."
      />
    );
  const upload = async (file?: File) => {
    if (!file) return;
    if (files.length >= 5) {
      toast.error("Не более 5 файлов");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      setFiles([...files, await api("files", "POST", form)]);
      toast.success("Вложение сохранено в приватном хранилище");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const submit = handleSubmit(async (data) => {
    setBusy(true);
    try {
      const { content } = await api("generate", "POST", { ...data, type });
      if (type === "review") {
        if (!files.length) throw new Error("Прикрепите работу для проверки.");
        if (
          manualScore === "" ||
          +manualScore < 0 ||
          +manualScore > +data.maxScore
        )
          throw new Error("Выставите корректный балл вручную.");
        content.sections.find((s: Section) => s.title === "Комментарии").body =
          comment || "Комментарий преподавателя не добавлен.";
        content.sections.find(
          (s: Section) => s.title === "Итоговый результат",
        ).body =
          `Оценка подтверждена преподавателем: ${manualScore} / ${data.maxScore}.`;
      }
      const material = await api("materials", "POST", {
        title: data.title,
        type,
        subject: data.subject,
        grade: +data.grade,
        contentJson: content,
        metadataJson: {
          ...data,
          attachmentIds: files.map((f) => f.id),
          ...(type === "review"
            ? {
                score: +manualScore,
                maxScore: +data.maxScore,
                approvedAt: new Date().toISOString(),
              }
            : {}),
        },
      });
      navigate("/materials/" + material.id);
      toast.success(
        type === "review"
          ? "Ручная оценка сохранена"
          : "Материал создан и сохранён",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  });
  return (
    <ToolPageLayout
      title={type === "review" ? "Проверить работу" : toolNames[type]}
      description={hints[type]}
      form={
        <form onSubmit={submit}>
          <div className="form-intro">
            <span className="step-number">01</span>
            <div>
              <h2>Настройте ваш материал</h2>
              <p>Всё можно отредактировать после создания.</p>
            </div>
          </div>
          <Field
            label={type === "review" ? "Название работы" : "Тема / название"}
          >
            <input
              {...register("title")}
              placeholder={
                type === "lesson"
                  ? "Например, обыкновенные дроби"
                  : "Введите тему материала"
              }
              required
              minLength={2}
              maxLength={200}
            />
            {errors.title && (
              <small className="form-error">
                Укажите тему от 2 до 200 символов
              </small>
            )}
          </Field>
          <div className="form-grid">
            <Field label="Предмет">
              <select {...register("subject")}>
                {subjects.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Класс">
              <select {...register("grade", { valueAsNumber: true })}>
                {Array.from({ length: 11 }, (_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1} класс
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="form-grid">
            <Field
              label={
                type === "video"
                  ? "Длительность, минут"
                  : "Время занятия, минут"
              }
            >
              <input
                type="number"
                min={5}
                max={240}
                {...register("duration", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Уровень сложности">
              <select {...register("difficulty")}>
                <option>Базовый</option>
                <option>Средний</option>
                <option>Продвинутый</option>
              </select>
            </Field>
          </div>
          {type === "lesson" && (
            <>
              <Field label="Тип урока">
                <select {...register("lessonType")}>
                  <option>Изучение нового материала</option>
                  <option>Закрепление знаний</option>
                  <option>Комбинированный урок</option>
                  <option>Практическая работа</option>
                </select>
              </Field>
              <Field label="Цель урока">
                <textarea
                  {...register("goals")}
                  placeholder="Что ученики узнают и научатся делать?"
                />
              </Field>
              <Field label="Планируемые результаты">
                <textarea {...register("results")} />
              </Field>
              <Field label="Оборудование и материалы">
                <input {...register("equipment")} />
              </Field>
            </>
          )}
          {["worksheet", "test", "presentation", "video"].includes(type) && (
            <Field
              label={
                type === "presentation"
                  ? "Количество слайдов"
                  : type === "video"
                    ? "Количество сцен"
                    : "Количество заданий"
              }
            >
              <input
                type="number"
                min={1}
                max={30}
                {...register("count", { valueAsNumber: true })}
              />
            </Field>
          )}
          {["test", "worksheet"].includes(type) && (
            <>
              <div className="form-grid">
                <Field label="Варианты">
                  <input
                    type="number"
                    min={1}
                    max={4}
                    {...register("variants", { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Максимальный балл">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    {...register("maxScore", { valueAsNumber: true })}
                  />
                </Field>
              </div>
              <div className="field">
                <span>Типы заданий</span>
                <small>Выберите один или несколько вариантов</small>
                <div className="question-types">
                  {questionTypes.map((questionType) => (
                    <label className="question-type" key={questionType}>
                      <input
                        type="checkbox"
                        value={questionType}
                        {...register("questionTypes")}
                      />
                      <span>{questionType}</span>
                    </label>
                  ))}
                </div>
              </div>
              <label className="check-field">
                <input type="checkbox" {...register("answerSheet")} />
                Отдельный лист ответов
              </label>
            </>
          )}
          {["presentation", "video"].includes(type) && (
            <div className="form-grid">
              <Field label="Стиль оформления">
                <select {...register("style")}>
                  <option>Космос</option>
                  <option>Светлый</option>
                  <option>Тёплый</option>
                </select>
              </Field>
              <Field label="Язык">
                <select {...register("language")}>
                  <option>Русский</option>
                  <option>English</option>
                </select>
              </Field>
            </div>
          )}
          {type === "review" && (
            <>
              <div
                className="upload-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  upload(e.dataTransfer.files[0]);
                }}
              >
                <Upload size={26} />
                <strong>
                  {uploading ? "Загрузка…" : "Перетащите работу сюда"}
                </strong>
                <span>JPG, PNG, WEBP, PDF, DOCX · до 10 МБ · до 5 файлов</span>
                <button
                  className="button secondary"
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInput.current?.click()}
                >
                  Выбрать файл
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  hidden
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </div>
              {files.map((f) => (
                <div className="file-row" key={f.id}>
                  <a
                    href={"/api/files/" + f.id}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.originalName}
                  </a>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Удалить вложение"
                    onClick={async () => {
                      try {
                        await api("files/" + f.id, "DELETE");
                        setFiles(files.filter((x) => x.id !== f.id));
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    <X size={14} />
                  </button>
                  {((ai?.vision && f.mimeType.startsWith("image/")) ||
                    (ai?.documents &&
                      f.mimeType.includes("wordprocessingml"))) && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const r = await api(`files/${f.id}/analyze`, "POST", {
                            prompt: `Проверь работу по предмету ${watch("subject")}. Критерии: ${watch("instructions")}`,
                          });
                          setComment(r.content);
                          toast.info(
                            "Предварительный анализ добавлен. Подтвердите оценку вручную.",
                          );
                        } catch (e) {
                          toast.error((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Анализ ИИ
                    </button>
                  )}
                </div>
              ))}
              <div className="notice">
                Автоматическое распознавание не включено в демо-режиме. Файл
                доступен для просмотра, оценку выставляете вы.
              </div>
              <div className="form-grid">
                <Field label="Максимальный балл">
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    {...register("maxScore", { valueAsNumber: true })}
                  />
                </Field>
                <Field label="Итоговый балл">
                  <input
                    type="number"
                    min={0}
                    max={watch("maxScore")}
                    value={manualScore}
                    onChange={(e) => setManualScore(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Field label="Комментарий преподавателя">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                />
              </Field>
            </>
          )}
          <Field
            label={
              type === "review"
                ? "Критерии и эталонный ответ"
                : "Дополнительные пожелания"
            }
          >
            <textarea
              {...register("instructions")}
              placeholder="Важные детали для вашего материала"
              maxLength={5000}
            />
          </Field>
          <div className="notice">
            <Sparkles size={16} />
            {type === "review"
              ? "Отчёт содержит вашу ручную оценку."
              : ai?.mode === "live"
                ? "ИИ создаст структуру и содержание. Проверьте результат перед использованием."
                : "Без API-ключа создаётся редактируемый шаблон. Он не содержит сгенерированных ИИ заданий."}
          </div>
          <GradientButton disabled={busy || uploading} className="full-width">
            {busy
              ? "Подготавливаем материал…"
              : type === "review"
                ? "Подтвердить и сохранить оценку"
                : "Создать структуру"}
            <ArrowRight size={17} />
          </GradientButton>
        </form>
      }
      result={
        <GlassCard className="tool-guide">
          <span className="eyebrow">КАК ЭТО РАБОТАЕТ</span>
          <div className="guide-orbit">
            <Sparkles size={34} />
          </div>
          <h2>
            Ваш замысел.
            <br />
            Ваша авторская работа.
          </h2>
          <p>
            Задайте направление — и получите структуру, которую легко превратить
            в готовый материал.
          </p>
          <ol>
            <li>Укажите тему и параметры</li>
            <li>Отредактируйте каждый блок</li>
            <li>Сохраните и скачайте документ</li>
          </ol>
          <div className="guide-formats">
            <span>DOCX</span>
            <span>PDF</span>
            <span>PPTX</span>
          </div>
        </GlassCard>
      }
    />
  );
}
export function MaterialsPage() {
  const { navigate } = useApp();
  const [items, setItems] = useState<MaterialRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [sort, setSort] = useState("new");
  const [error, setError] = useState("");
  const load = () =>
    api<MaterialRecord[]>("materials")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const filtered = (items || [])
    .filter(
      (m) =>
        (!type || m.type === type) &&
        (!subject || m.subject === subject) &&
        m.title.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title, "ru")
        : sort === "old"
          ? a.updatedAt.localeCompare(b.updatedAt)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <AnimatedPage>
      <header className="page-heading heading-row">
        <div>
          <span className="eyebrow">ВАША КОЛЛЕКЦИЯ ИДЕЙ</span>
          <h1>Мои материалы</h1>
          <p>Всё, что вы создали. Всё, к чему хочется вернуться.</p>
        </div>
        <GradientButton onClick={() => navigate("/tools/lesson")}>
          <Plus size={17} />
          Новый материал
        </GradientButton>
      </header>
      <div className="filters">
        <label className="search-field">
          <Search size={17} />
          <input
            placeholder="Найти материал…"
            aria-label="Поиск материалов"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Тип материала"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Все типы</option>
          {toolTypes.map((t) => (
            <option key={t} value={t}>
              {toolNames[t]}
            </option>
          ))}
        </select>
        <select
          aria-label="Предмет"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">Все предметы</option>
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
          <option value="name">По названию</option>
        </select>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : items === null ? (
        <div className="skeleton-list" />
      ) : !filtered.length ? (
        <GlassCard>
          <EmptyState
            icon={<FolderOpen size={34} />}
            title={
              items.length
                ? "Материалы не найдены"
                : "Здесь будут ваши открытия"
            }
            description={
              items.length
                ? "Попробуйте другой запрос или фильтр."
                : "Создайте первый учебный материал и сохраните его в коллекции."
            }
            action={
              <button
                className="button primary"
                onClick={() => navigate("/tools/lesson")}
              >
                Создать материал
              </button>
            }
          />
        </GlassCard>
      ) : (
        <div className="materials-grid">
          {filtered.map((m) => (
            <GlassCard key={m.id} className="material-card">
              <div className="material-card-top">
                <span className="file-icon">
                  <FileText size={24} />
                </span>
                <span className="tag">
                  {m.status === "ready" ? "Готово" : "Черновик"}
                </span>
              </div>
              <button
                className="material-open"
                onClick={() => navigate("/materials/" + m.id)}
              >
                <h2>{m.title}</h2>
                <p>
                  {toolNames[m.type]} · {m.subject} · {m.grade} класс
                </p>
              </button>
              <small>
                Изменён {new Date(m.updatedAt).toLocaleDateString("ru-RU")}
              </small>
              <div className="material-actions">
                <button
                  className="text-button"
                  onClick={() => navigate("/materials/" + m.id)}
                >
                  Открыть <ArrowRight size={13} />
                </button>
                <button
                  className="icon-button"
                  title="Переименовать"
                  onClick={async () => {
                    const title = prompt("Название материала", m.title);
                    if (title?.trim())
                      try {
                        await api("materials/" + m.id, "PATCH", {
                          ...m,
                          title,
                        });
                        load();
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                  }}
                >
                  <FileText size={15} />
                </button>
                <button
                  className="icon-button"
                  title="Создать копию"
                  onClick={async () => {
                    try {
                      await api("materials/" + m.id + "/duplicate", "POST", {});
                      load();
                      toast.success("Копия создана");
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                >
                  <Copy size={15} />
                </button>
                <button
                  className="icon-button danger"
                  title="Удалить материал"
                  onClick={async () => {
                    if (
                      confirm(
                        "Удалить материал без возможности восстановления?",
                      )
                    )
                      try {
                        await api("materials/" + m.id, "DELETE");
                        load();
                        toast.success("Материал удалён");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </AnimatedPage>
  );
}
export function MaterialEditor({ id }: { id: string }) {
  const { user, navigate } = useApp();
  const [material, setMaterial] = useState<MaterialRecord | null>(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState(false);
  const [selected, setSelected] = useState(0);
  const [show, setShow] = useState(false);
  const [scenePlaying, setScenePlaying] = useState(false);
  const [saveError, setSaveError] = useState("");
  const current = useRef<MaterialRecord | null>(null);
  const revision = useRef(0);
  const inFlight = useRef(false);
  const savedRevision = useRef(0);
  useEffect(() => {
    api<MaterialRecord>("materials/" + id)
      .then((m) => {
        setMaterial(m);
        current.current = m;
      })
      .catch((e) => setError(e.message));
  }, [id]);
  const change = (m: MaterialRecord) => {
    current.current = m;
    revision.current++;
    setMaterial(m);
    setDirty(true);
  };
  const save = async () => {
    if (inFlight.current || !current.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError("");
    try {
      while (savedRevision.current < revision.current) {
        const snap = current.current;
        const rev = revision.current;
        const result = await api<MaterialRecord>(
          "materials/" + id,
          "PATCH",
          snap,
        );
        savedRevision.current = rev;
        const merged: MaterialRecord = {
          ...current.current!,
          version: result.version,
          updatedAt: result.updatedAt,
        };
        current.current = merged;
        setMaterial(merged);
      }
      setDirty(false);
    } catch (e) {
      setSaveError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  useEffect(() => {
    if (!dirty || saveError) return;
    const timer = setTimeout(save, 1100);
    return () => clearTimeout(timer);
  }, [material, dirty, saveError]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (revision.current > savedRevision.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    const protectNavigation = (event:Event) => {
      if(revision.current>savedRevision.current && !confirm('Есть несохранённые изменения. Покинуть редактор и отказаться от них?')) event.preventDefault();
    };
    window.addEventListener('edupilot:navigate',protectNavigation);
    return () => {window.removeEventListener("beforeunload", prevent);window.removeEventListener('edupilot:navigate',protectNavigation);};
  }, []);
  useEffect(() => {
    if (!scenePlaying || !material) return;
    const seconds = material.contentJson.sections[selected]?.duration || 5;
    const t = setTimeout(() => {
      if (selected < material.contentJson.sections.length - 1)
        setSelected(selected + 1);
      else setScenePlaying(false);
    }, seconds * 1000);
    return () => clearTimeout(t);
  }, [scenePlaying, selected]);
  if (error)
    return (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  if (!material) return <div className="skeleton-list" />;
  const m = material;
  const sections = m.contentJson.sections;
  const updateSections = (next: Section[]) =>
    change({ ...m, contentJson: { ...m.contentJson, sections: next } });
  const updateSection = (i: number, p: Partial<Section>) =>
    updateSections(sections.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const move = (i: number, delta: number) => {
    const next = [...sections];
    [next[i], next[i + delta]] = [next[i + delta], next[i]];
    updateSections(next);
    setSelected(i + delta);
  };
  const visual = ["presentation", "video"].includes(m.type);
  const slide = sections[selected] || sections[0];
  if (m.canEdit === false)
    return (
      <AnimatedPage>
        <header className="page-heading">
          <span className="eyebrow">
            МАТЕРИАЛ ПРЕПОДАВАТЕЛЯ · ТОЛЬКО ЧТЕНИЕ
          </span>
          <h1>{m.title}</h1>
          <p>
            {m.subject} · {m.grade} класс
          </p>
        </header>
        <GlassCard>
          {sections.map((s) => (
            <section className="section-space" key={s.id}>
              <h2>{s.title}</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>
              {s.options?.map((o) => (
                <p key={o}>{o}</p>
              ))}
            </section>
          ))}
        </GlassCard>
      </AnimatedPage>
    );
  const download = async (format: string) => {
    await save();
    if (revision.current > savedRevision.current) {
      toast.error("Сначала сохраните изменения");
      return;
    }
    try {
      const response = await fetch(
        `/api/materials/${id}/export?format=${format}&answers=${answers}`,
      );
      if (!response.ok) {
        const e = await response.json();
        throw Error((e as any).error);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = m.title + "." + format;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      toast.success("Файл подготовлен");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <AnimatedPage>
      <header className="editor-heading">
        <div>
          <span className="eyebrow">
            {toolNames[m.type]} · {m.grade} КЛАСС
          </span>
          <input
            className="title-input"
            value={m.title}
            aria-label="Название материала"
            onChange={(e) => change({ ...m, title: e.target.value })}
            maxLength={200}
          />
          <div className="save-status">
            {saving ? (
              <>
                <Clock size={13} />
                Сохранение…
              </>
            ) : saveError ? (
              <span className="form-error">{saveError}</span>
            ) : dirty ? (
              "Есть несохранённые изменения"
            ) : (
              <>
                <CheckCircle2 size={13} />
                Сохранено в аккаунте
              </>
            )}
          </div>
        </div>
        <GradientButton disabled={saving} onClick={save}>
          <Save size={16} />
          Сохранить
        </GradientButton>
      </header>
      <div className="editor-toolbar">
        <div className="button-row">
          <button className="button secondary" onClick={() => download("docx")}>
            <Download size={14} />
            DOCX
          </button>
          <button className="button secondary" onClick={() => download("pdf")}>
            <Download size={14} />
            PDF
          </button>
          {visual && (
            <button
              className="button secondary"
              onClick={() => download("pptx")}
            >
              <Presentation size={14} />
              PPTX
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Печать"
            onClick={() => window.print()}
          >
            <Printer size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Создать копию"
            onClick={async () => {
              await save();
              if (revision.current > savedRevision.current) return;
              try {
                const item = await api(
                  "materials/" + id + "/duplicate",
                  "POST",
                  {},
                );
                navigate("/materials/" + item.id);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Copy size={17} />
          </button>
        </div>
        <div className="button-row">
          {user.role === "teacher" && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={answers}
                onChange={(e) => setAnswers(e.target.checked)}
              />
              Ответы преподавателя
            </label>
          )}
          <select
            aria-label="Статус"
            value={m.status}
            onChange={(e) => change({ ...m, status: e.target.value })}
          >
            <option value="draft">Черновик</option>
            <option value="ready">Готово</option>
          </select>
        </div>
      </div>
      {m.contentJson.demo && (
        <div className="notice">
          <Sparkles size={16} />
          Демонстрационный шаблон. Замените подсказки своим содержанием перед
          использованием.
        </div>
      )}
      {m.type === "lesson" && (
        <div className="duration-info">
          Длительность этапов:{" "}
          {sections.reduce((n, s) => n + (s.duration || 0), 0)} мин. из{" "}
          {m.contentJson.totalDuration || 45} мин.
          {sections.reduce((n, s) => n + (s.duration || 0), 0) !==
            m.contentJson.totalDuration && (
            <span className="form-error"> Проверьте сумму длительностей.</span>
          )}
        </div>
      )}
      {visual ? (
        <div className="slides-editor">
          <div className="slides-list">
            {sections.map((s, i) => (
              <div className="slide-list-item" key={s.id}>
                <button
                  className={selected === i ? "active" : ""}
                  onClick={() => setSelected(i)}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ background: s.background || "#080D1C" }}>
                    {s.title}
                  </div>
                </button>
              </div>
            ))}
            <button
              className="button secondary full-width"
              onClick={() => {
                updateSections([
                  ...sections,
                  {
                    id: crypto.randomUUID(),
                    title: "Новый слайд",
                    body: "Добавьте содержание",
                    background: "#111A30",
                    ...(m.type === "video" ? { duration: 30 } : {}),
                  },
                ]);
                setSelected(sections.length);
              }}
            >
              <Plus size={16} />
              Добавить
            </button>
          </div>
          <div className="slide-workspace">
            <div
              className="slide-preview"
              style={
                {
                  background: slide.background || "#080D1C",
                  "--slide-text": slidePalette(slide.background).text,
                  "--slide-muted": slidePalette(slide.background).muted,
                  "--slide-accent": slidePalette(slide.background).accent,
                } as any
              }
            >
              <span className="slide-kicker">
                {m.subject} / {m.grade} КЛАСС
              </span>
              <h2>{slide.title}</h2>
              <p>{slide.body}</p>
              {slide.imageId && (
                <img
                  src={"/api/files/" + slide.imageId}
                  alt="Иллюстрация слайда"
                />
              )}
              <span className="slide-footer">
                EduPilot · {selected + 1} / {sections.length}
              </span>
            </div>
            <GlassCard className="slide-controls">
              <div className="form-grid">
                <Field label="Заголовок">
                  <input
                    value={slide.title}
                    onChange={(e) =>
                      updateSection(selected, { title: e.target.value })
                    }
                  />
                </Field>
                <Field label="Цвет фона">
                  <input
                    type="color"
                    value={slide.background || "#080D1C"}
                    onChange={(e) =>
                      updateSection(selected, { background: e.target.value })
                    }
                  />
                </Field>
              </div>
              <Field
                label={
                  m.type === "video"
                    ? "Текст диктора и субтитры"
                    : "Текст слайда"
                }
              >
                <textarea
                  rows={6}
                  value={slide.body}
                  onChange={(e) =>
                    updateSection(selected, { body: e.target.value })
                  }
                />
              </Field>
              {m.type === "video" && (
                <Field label="Длительность сцены, секунд">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={slide.duration || 30}
                    onChange={(e) =>
                      updateSection(selected, { duration: +e.target.value })
                    }
                  />
                </Field>
              )}
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => setShow(true)}
                >
                  <Play size={15} />
                  Показ
                </button>
                {m.type === "video" && (
                  <>
                    <button
                      className="button secondary"
                      onClick={() => setScenePlaying(!scenePlaying)}
                    >
                      {scenePlaying ? "Остановить" : "Проиграть сцены"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => {
                        if (!("speechSynthesis" in window)) {
                          toast.info("Браузер не поддерживает прослушивание");
                          return;
                        }
                        speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(
                          slide.body,
                        );
                        utterance.lang = "ru-RU";
                        speechSynthesis.speak(utterance);
                      }}
                    >
                      <Volume2 size={15} />
                      Прослушать
                    </button>
                  </>
                )}
                <label className="button secondary">
                  <Upload size={15} />
                  Изображение
                  <input
                    type="file"
                    hidden
                    accept="image/png,image/jpeg"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const form = new FormData();
                      form.set("file", f);
                      try {
                        const item = await api("files", "POST", form);
                        updateSection(selected, { imageId: item.id });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                </label>
                <button
                  className="icon-button"
                  title="Вверх"
                  disabled={!selected}
                  onClick={() => move(selected, -1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon-button"
                  title="Вниз"
                  disabled={selected === sections.length - 1}
                  onClick={() => move(selected, 1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon-button danger"
                  title="Удалить слайд"
                  disabled={sections.length < 2}
                  onClick={() => {
                    updateSections(sections.filter((_, i) => i !== selected));
                    setSelected(Math.max(0, selected - 1));
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </GlassCard>
            {m.type === "video" && (
              <div className="notice">
                Прослушивание использует голос браузера и не экспортирует аудио.
                MP4 с озвучкой требует отдельного TTS и видеоконвейера. Сейчас
                доступны сценарий, PDF и PPTX.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="document-editor">
          <div className="a4-paper">
            <div className="document-meta">
              EDUPILOT / {m.subject.toUpperCase()} / {m.grade} КЛАСС
            </div>
            <h1>{m.title}</h1>
            {sections.map((s, i) => (
              <section className="document-section" key={s.id}>
                <div className="document-section-heading">
                  <input
                    aria-label={`Заголовок раздела ${i + 1}`}
                    value={s.title}
                    onChange={(e) =>
                      updateSection(i, { title: e.target.value })
                    }
                  />
                  <div className="section-actions">
                    <button
                      className="icon-button"
                      aria-label="Переместить выше"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label="Переместить ниже"
                      disabled={i === sections.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label="Удалить раздел"
                      disabled={sections.length < 2}
                      onClick={() =>
                        updateSections(sections.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <textarea
                  aria-label={`Содержание раздела ${i + 1}`}
                  rows={Math.max(
                    3,
                    Math.min(18, s.body.split("\n").length + 2),
                  )}
                  value={s.body}
                  onChange={(e) => updateSection(i, { body: e.target.value })}
                />
                {s.duration !== undefined && (
                  <label className="inline-field">
                    Минут{" "}
                    <input
                      type="number"
                      min={0}
                      max={240}
                      value={s.duration}
                      onChange={(e) =>
                        updateSection(i, { duration: +e.target.value })
                      }
                    />
                  </label>
                )}
                {["test", "worksheet"].includes(m.type) && (
                  <>
                    <div className="question-options">
                      <label>
                        Варианты ответа (по одному в строке)
                        <textarea
                          rows={2}
                          value={(s.options || []).join("\n")}
                          onChange={(e) =>
                            updateSection(i, {
                              options: e.target.value
                                .split("\n")
                                .filter(Boolean),
                            })
                          }
                        />
                      </label>
                      <label className="inline-field">
                        Баллы{" "}
                        <input
                          type="number"
                          min={0}
                          max={1000}
                          value={s.points || 0}
                          onChange={(e) =>
                            updateSection(i, { points: +e.target.value })
                          }
                        />
                      </label>
                    </div>
                    {(answers || user.role === "student") && (
                      <label className="answer-editor">
                        Ответ / критерии
                        <textarea
                          rows={2}
                          value={s.answer || ""}
                          onChange={(e) =>
                            updateSection(i, { answer: e.target.value })
                          }
                        />
                      </label>
                    )}
                  </>
                )}
              </section>
            ))}
            <button
              className="button secondary"
              onClick={() =>
                updateSections([
                  ...sections,
                  { id: crypto.randomUUID(), title: "Новый раздел", body: "" },
                ])
              }
            >
              <Plus size={16} />
              Добавить раздел
            </button>
          </div>
        </div>
      )}
      {m.type === "test" && (
        <button
          className="button secondary"
          onClick={async () => {
            await save();
            if (revision.current > savedRevision.current) return;
            navigate("/quiz/" + id);
          }}
        >
          <Check size={15} />
          Пройти тест
        </button>
      )}
      {show && (
        <div
          className="presentation-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Показ презентации"
        >
          <button
            className="icon-button close-presentation"
            aria-label="Закрыть показ"
            onClick={() => {
              setShow(false);
              speechSynthesis?.cancel();
            }}
          >
            <X />
          </button>
          <div
            className="slide-preview"
            style={
              {
                background: slide.background || "#080D1C",
                "--slide-text": slidePalette(slide.background).text,
                "--slide-muted": slidePalette(slide.background).muted,
                "--slide-accent": slidePalette(slide.background).accent,
              } as any
            }
          >
            <span className="slide-kicker">{m.subject}</span>
            <h2>{slide.title}</h2>
            <p>{slide.body}</p>
            {slide.imageId && (
              <img src={"/api/files/" + slide.imageId} alt="Иллюстрация" />
            )}
          </div>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={!selected}
              onClick={() => setSelected(selected - 1)}
            >
              Назад
            </button>
            <span>
              {selected + 1} / {sections.length}
            </span>
            <button
              className="button secondary"
              disabled={selected === sections.length - 1}
              onClick={() => setSelected(selected + 1)}
            >
              Далее
            </button>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
export function QuizPage({ id }: { id: string }) {
  const [material, setMaterial] = useState<MaterialRecord | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [quiz, setQuiz] = useState<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    api<MaterialRecord>("materials/" + id)
      .then((m) => {
        setMaterial(m);
        if (m.type !== "test")
          throw new Error("Этот материал не является тестом.");
        api(`materials/${id}/quiz-start`, "POST", {})
          .then((q) => {
            setQuiz(q);
            setSeconds(
              Math.max(
                0,
                Math.floor(
                  (new Date(q.expiresAt).getTime() - Date.now()) / 1000,
                ),
              ),
            );
          })
          .catch((e) => setError(e.message));
      })
      .catch((e) => setError(e.message));
    api("attempts")
      .then(setHistory)
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!material || result) return;
    const t = setInterval(
      () =>
        setSeconds(() =>
          Math.max(
            0,
            Math.floor(
              (new Date(quiz?.expiresAt || 0).getTime() - Date.now()) / 1000,
            ),
          ),
        ),
      1000,
    );
    return () => clearInterval(t);
  }, [material, result, quiz]);
  if (error) return <p className="form-error">{error}</p>;
  if (!material) return <div className="skeleton-list" />;
  return (
    <AnimatedPage>
      <header className="page-heading">
        <span className="eyebrow">ПРОВЕРКА ЗНАНИЙ</span>
        <h1>{material.title}</h1>
        <p>
          <Clock size={15} /> Осталось {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")}
        </p>
      </header>
      {result ? (
        <GlassCard>
          <h2>
            Результат: {result.score} / {result.maxScore}
          </h2>
          {result.result.map((r: any, i: number) => (
            <p key={r.id}>
              {i + 1}. {r.correct ? "Верно" : "Ошибка"} · Правильный ответ:{" "}
              {r.answer}
            </p>
          ))}
        </GlassCard>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setResult(
                await api(`materials/${id}/quiz`, "POST", {
                  answers,
                  sessionId: quiz?.sessionId,
                }),
              );
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          {material.contentJson.sections.map((s, i) => (
            <GlassCard key={s.id} className="quiz-question">
              <h2>{s.title}</h2>
              <p>{s.body}</p>
              {s.options?.length ? (
                s.options.map((o) => (
                  <label className="check-field" key={o}>
                    <input
                      type="radio"
                      name={s.id}
                      value={o}
                      checked={answers[s.id] === o}
                      onChange={() => setAnswers({ ...answers, [s.id]: o })}
                    />
                    {o}
                  </label>
                ))
              ) : (
                <Field label="Ваш ответ">
                  <input
                    value={answers[s.id] || ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [s.id]: e.target.value })
                    }
                  />
                </Field>
              )}
            </GlassCard>
          ))}
          <GradientButton disabled={!seconds}>Завершить тест</GradientButton>
        </form>
      )}
      <h2 className="section-space">История попыток</h2>
      {history.length ? (
        history.map((a) => (
          <p key={a.id}>
            {a.material.title}: {a.score} баллов ·{" "}
            {new Date(a.createdAt).toLocaleString("ru-RU")}
          </p>
        ))
      ) : (
        <p className="muted">Вы ещё не проходили тесты.</p>
      )}
    </AnimatedPage>
  );
}
