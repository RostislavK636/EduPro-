"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  ArrowRight,
  Copy,
  Trash2,
  BookOpen,
  BarChart3,
  Send,
  FileText,
  Pencil,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/client";
import { subjects } from "@/lib/domain";
import { useApp } from "../app-context";
import {
  AnimatedPage,
  GlassCard,
  Field,
  GradientButton,
  EmptyState,
} from "../ui/edupilot";
export function ClassesPage({ id }: { id?: string }) {
  const { user, navigate } = useApp();
  const teacher = user.role === "teacher";
  const [classes, setClasses] = useState<any[] | null>(null);
  const [school, setSchool] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const load = async () => {
    setError("");
    try {
      if (id) setSchool(await api("classes/" + id));
      else setClasses(await api("classes"));
      if (teacher) setMaterials(await api("materials"));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, [id]);
  const submit = async (
    e: React.FormEvent<HTMLFormElement>,
    action: (f: FormData) => Promise<void>,
  ) => {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await action(new FormData(form));
      form.reset();
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  if (error)
    return (
      <p className="form-error" role="alert">
        {error}
        <button className="button secondary" onClick={load}>
          Повторить
        </button>
      </p>
    );
  if (!id)
    return (
      <AnimatedPage>
        <header className="page-heading heading-row">
          <div>
            <span className="eyebrow">УЧИТЬСЯ. ВМЕСТЕ.</span>
            <h1>{teacher ? "Мои классы" : "Мои занятия"}</h1>
            <p>
              {teacher
                ? "Объедините учеников вокруг новых открытий."
                : "Ваши классы, задания и результаты."}
            </p>
          </div>
          {teacher && (
            <GradientButton onClick={() => setShowCreate(!showCreate)}>
              <Plus size={17} />
              Создать класс
            </GradientButton>
          )}
        </header>
        {showCreate && (
          <GlassCard className="class-create">
            <h2>Новый класс</h2>
            <form
              onSubmit={(e) =>
                submit(e, async (f) => {
                  await api("classes", "POST", {
                    name: f.get("name"),
                    subject: f.get("subject"),
                  });
                  setShowCreate(false);
                  toast.success("Класс создан");
                })
              }
            >
              <div className="form-grid">
                <Field label="Название">
                  <input
                    name="name"
                    placeholder="Например, 7 А"
                    maxLength={100}
                    required
                  />
                </Field>
                <Field label="Предмет">
                  <select name="subject">
                    {subjects.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <GradientButton>Создать</GradientButton>
            </form>
          </GlassCard>
        )}
        {!teacher && (
          <GlassCard className="join-class">
            <h2>Присоединиться к классу</h2>
            <p>Попросите одноразовый код у преподавателя.</p>
            <form
              onSubmit={(e) =>
                submit(e, async (f) => {
                  await api("classes/join", "POST", { code: f.get("code") });
                  toast.success("Вы присоединились к классу");
                })
              }
            >
              <input
                name="code"
                placeholder="Код приглашения"
                aria-label="Код приглашения"
                required
              />
              <GradientButton>
                Присоединиться <ArrowRight size={15} />
              </GradientButton>
            </form>
          </GlassCard>
        )}
        {classes === null ? (
          <div className="skeleton-list" />
        ) : !classes.length ? (
          <GlassCard>
            <EmptyState
              icon={<Users size={36} />}
              title={
                teacher
                  ? "Создайте первое сообщество"
                  : "Новые открытия — впереди"
              }
              description={
                teacher
                  ? "Пригласите учеников и начните выдавать задания."
                  : "Присоединитесь к классу по коду преподавателя."
              }
            />
          </GlassCard>
        ) : (
          <div className="class-grid">
            {classes.map((c) => (
              <GlassCard key={c.id} className="class-card">
                <div className="class-symbol">
                  <Users size={26} />
                </div>
                <h2>{c.name}</h2>
                <p>{c.subject}</p>
                <div className="class-counts">
                  <span>
                    <b>{c._count.enrollments}</b> учеников
                  </span>
                  <span>
                    <b>{c._count.assignments}</b> заданий
                  </span>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("/classes/" + c.id)}
                >
                  Открыть класс <ArrowRight size={16} />
                </button>
              </GlassCard>
            ))}
          </div>
        )}
      </AnimatedPage>
    );
  if (!school) return <div className="skeleton-list" />;
  const grades = school.assignments.flatMap((a: any) =>
    a.submissions
      .filter((s: any) => s.grade)
      .map((s: any) => ({ ...s.grade, date: s.submittedAt })),
  );
  const mean = grades.length
    ? Math.round(
        grades.reduce(
          (n: number, g: any) => n + (g.score / g.maxScore) * 100,
          0,
        ) / grades.length,
      )
    : null;
  const distribution = [
    { name: "0–49%", count: 0 },
    { name: "50–69%", count: 0 },
    { name: "70–89%", count: 0 },
    { name: "90–100%", count: 0 },
  ];
  grades.forEach((g: any) => {
    const p = (g.score / g.maxScore) * 100;
    distribution[p < 50 ? 0 : p < 70 ? 1 : p < 90 ? 2 : 3].count++;
  });
  const progress = grades
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((g: any) => ({
      date: new Date(g.date).toLocaleDateString("ru-RU"),
      result: Math.round((g.score / g.maxScore) * 100),
    }));
  return (
    <AnimatedPage>
      <header className="page-heading heading-row">
        <div>
          <span className="eyebrow">{school.subject}</span>
          <h1>{school.name}</h1>
          <p>Общее пространство для учебных открытий.</p>
        </div>
        {teacher && (
          <button
            className="button secondary"
            onClick={async () => {
              const name = prompt("Новое название класса", school.name);
              if (name?.trim())
                try {
                  await api("classes/" + id, "PATCH", { name });
                  load();
                } catch (e) {
                  toast.error((e as Error).message);
                }
            }}
          >
            <Pencil size={15} />
            Переименовать
          </button>
        )}
      </header>
      {teacher && (
        <>
          <div className="stats-grid">
            <GlassCard>
              <Users />
              <b>{school.enrollments.length}</b>
              <span>учеников</span>
            </GlassCard>
            <GlassCard>
              <BookOpen />
              <b>{school.assignments.length}</b>
              <span>заданий</span>
            </GlassCard>
            <GlassCard>
              <BarChart3 />
              <b>{mean === null ? "—" : mean + "%"}</b>
              <span>средний результат</span>
            </GlassCard>
            <GlassCard>
              <FileText />
              <b>{grades.length}</b>
              <span>оценённых работ</span>
            </GlassCard>
          </div>
          <GlassCard className="invite-card">
            <div>
              <h2>Пригласить ученика</h2>
              <p>Одноразовый код действует 24 часа.</p>
            </div>
            {invite ? (
              <div className="invite-code">
                <code>{invite}</code>
                <button
                  className="icon-button"
                  title="Копировать код"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(invite)
                      .then(() => toast.success("Код скопирован"))
                      .catch(() => toast.error("Не удалось скопировать код"))
                  }
                >
                  <Copy size={17} />
                </button>
              </div>
            ) : (
              <GradientButton
                onClick={async () => {
                  try {
                    const i = await api(`classes/${id}/invite`, "POST", {});
                    setInvite(i.id);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Получить код <Plus size={16} />
              </GradientButton>
            )}
          </GlassCard>
          <div className="class-detail-grid">
            <GlassCard>
              <h2>Ученики</h2>
              {school.enrollments.length ? (
                school.enrollments.map((e: any) => (
                  <div className="student-row" key={e.id}>
                    <span className="avatar">{e.student.firstName[0]}</span>
                    <span>
                      <b>
                        {e.student.firstName} {e.student.lastName}
                      </b>
                      <small>{e.student.email}</small>
                    </span>
                    <button
                      className="icon-button danger"
                      title="Удалить ученика из класса"
                      onClick={async () => {
                        if (confirm("Удалить ученика из класса?"))
                          try {
                            await api(`classes/${id}/student`, "DELETE", {
                              studentId: e.student.id,
                            });
                            load();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Ученики появятся после ввода кода приглашения.
                </p>
              )}
            </GlassCard>
            <GlassCard>
              <h2>Новое задание</h2>
              {materials.length ? (
                <form
                  onSubmit={(e) =>
                    submit(e, async (f) => {
                      await api(`classes/${id}/assignment`, "POST", {
                        title: f.get("title"),
                        materialId: f.get("materialId"),
                        dueDate: f.get("dueDate") || undefined,
                      });
                      toast.success("Задание выдано");
                    })
                  }
                >
                  <Field label="Название задания">
                    <input name="title" required maxLength={200} />
                  </Field>
                  <Field label="Материал">
                    <select name="materialId">
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Срок сдачи">
                    <input name="dueDate" type="datetime-local" />
                  </Field>
                  <GradientButton>
                    Выдать задание <Send size={15} />
                  </GradientButton>
                </form>
              ) : (
                <p className="muted">Сначала создайте учебный материал.</p>
              )}
            </GlassCard>
          </div>
          {grades.length > 0 && (
            <div className="charts-grid">
              <GlassCard>
                <h2>Распределение результатов</h2>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distribution}>
                      <CartesianGrid stroke="#25324c" vertical={false} />
                      <XAxis dataKey="name" stroke="#ABB7D0" fontSize={11} />
                      <YAxis
                        allowDecimals={false}
                        stroke="#ABB7D0"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#111A30",
                          border: "1px solid #34435d",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        name="Работ"
                        fill="#64F5DA"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
              <GlassCard>
                <h2>Динамика результатов</h2>
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progress}>
                      <CartesianGrid stroke="#25324c" />
                      <XAxis dataKey="date" stroke="#ABB7D0" fontSize={11} />
                      <YAxis domain={[0, 100]} stroke="#ABB7D0" fontSize={11} />
                      <Tooltip contentStyle={{ background: "#111A30" }} />
                      <Line
                        type="monotone"
                        dataKey="result"
                        name="Результат, %"
                        stroke="#A58BFF"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </div>
          )}
        </>
      )}
      <div className="section-heading section-space">
        <h2>Задания класса</h2>
      </div>
      {school.assignments.length ? (
        school.assignments.map((a: any) => (
          <GlassCard key={a.id} className="assignment-card">
            <div className="section-heading">
              <div>
                <h2>{a.title}</h2>
                <p>
                  {a.dueDate
                    ? "До " + new Date(a.dueDate).toLocaleString("ru-RU")
                    : "Без срока сдачи"}
                </p>
              </div>
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() => navigate("/materials/" + a.materialId)}
                >
                  Материал <ArrowRight size={14} />
                </button>
                {!teacher && (
                  <button
                    className="button secondary"
                    onClick={() => navigate("/quiz/" + a.materialId)}
                  >
                    Пройти тест
                  </button>
                )}
              </div>
            </div>
            {teacher ? (
              a.submissions.length ? (
                a.submissions.map((s: any) => (
                  <div className="submission" key={s.id}>
                    <h3>
                      {s.student.firstName} {s.student.lastName}
                    </h3>
                    <p className="submission-text">{s.contentJson.text}</p>
                    <form
                      onSubmit={(e) =>
                        submit(e, async (f) => {
                          await api(`classes/${id}/grade`, "POST", {
                            submissionId: s.id,
                            score: Number(f.get("score")),
                            maxScore: Number(f.get("maxScore")),
                            teacherComment: f.get("teacherComment"),
                          });
                          toast.success("Оценка подтверждена и сохранена");
                        })
                      }
                    >
                      <div className="form-grid">
                        <Field label="Балл">
                          <input
                            type="number"
                            name="score"
                            min={0}
                            defaultValue={s.grade?.score || 0}
                            required
                          />
                        </Field>
                        <Field label="Максимум">
                          <input
                            type="number"
                            name="maxScore"
                            min={1}
                            max={1000}
                            defaultValue={s.grade?.maxScore || 10}
                            required
                          />
                        </Field>
                      </div>
                      <Field label="Комментарий">
                        <input
                          name="teacherComment"
                          defaultValue={s.grade?.teacherComment || ""}
                        />
                      </Field>
                      <button className="button secondary">
                        Подтвердить оценку
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <p className="muted">Работ на проверку пока нет.</p>
              )
            ) : (
              <>
                <form
                  onSubmit={(e) =>
                    submit(e, async (f) => {
                      await api(`classes/${id}/submit`, "POST", {
                        assignmentId: a.id,
                        text: f.get("text"),
                      });
                      toast.success("Работа сдана");
                    })
                  }
                >
                  <Field label="Ваш ответ">
                    <textarea
                      name="text"
                      required
                      maxLength={20000}
                      defaultValue={a.submissions[0]?.contentJson.text || ""}
                      rows={5}
                    />
                  </Field>
                  <GradientButton>
                    Отправить работу <Send size={14} />
                  </GradientButton>
                </form>
                {a.submissions[0]?.grade && (
                  <div className="grade-result">
                    <h3>
                      Оценка: {a.submissions[0].grade.score} /{" "}
                      {a.submissions[0].grade.maxScore}
                    </h3>
                    <p>{a.submissions[0].grade.teacherComment}</p>
                  </div>
                )}
              </>
            )}
          </GlassCard>
        ))
      ) : (
        <GlassCard>
          <EmptyState
            icon={<BookOpen size={30} />}
            title="Пока нет заданий"
            description={
              teacher
                ? "Выберите сохранённый материал и выдайте его классу."
                : "Преподаватель добавит задания здесь."
            }
          />
        </GlassCard>
      )}
    </AnimatedPage>
  );
}
