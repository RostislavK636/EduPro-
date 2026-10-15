import { z } from "zod";
export const toolTypes = [
  "lesson",
  "worksheet",
  "test",
  "presentation",
  "video",
  "review",
  "notes",
] as const;
export type ToolType = (typeof toolTypes)[number];
export const toolNames: Record<ToolType, string> = {
  lesson: "План урока",
  worksheet: "Рабочий лист",
  test: "Контрольная работа",
  presentation: "Презентация",
  video: "Видеоурок",
  review: "Проверка работы",
  notes: "Конспект",
};
export const subjects = [
  "Математика",
  "Русский язык",
  "Литература",
  "История",
  "Обществознание",
  "Информатика",
  "Физика",
  "Химия",
  "Биология",
  "География",
  "Иностранный язык",
  "Другое",
];
export const sectionSchema = z.object({
  id: z.string(),
  title: z.string().max(300),
  body: z.string().max(20000),
  duration: z.number().min(0).max(10000).optional(),
  answer: z.string().max(10000).optional(),
  points: z.number().min(0).max(1000).optional(),
  options: z.array(z.string().max(1000)).max(10).optional(),
  background: z
    .string()
    .regex(/^#[a-fA-F0-9]{6}$/)
    .optional(),
  imageId: z.string().optional(),
});
export const documentSchema = z.object({
  sections: z.array(sectionSchema).min(1).max(100),
  demo: z.boolean().default(true),
  totalDuration: z.number().optional(),
});
export type DocumentContent = z.infer<typeof documentSchema>;
export type Section = z.infer<typeof sectionSchema>;
export const generatorSchema = z.object({
  type: z.enum(toolTypes),
  title: z.string().min(2).max(200),
  subject: z.string().min(1).max(100),
  grade: z.coerce.number().int().min(1).max(11),
  duration: z.coerce.number().int().min(5).max(240).default(45),
  count: z.coerce.number().int().min(1).max(30).default(6),
  variants: z.coerce.number().int().min(1).max(4).default(1),
  maxScore: z.coerce.number().min(1).max(1000).default(10),
  difficulty: z.string().max(100).default("Средний"),
  goals: z.string().max(4000).default(""),
  results: z.string().max(4000).default(""),
  equipment: z.string().max(4000).default(""),
  lessonType: z.string().max(100).default("Изучение нового материала"),
  instructions: z.string().max(5000).default(""),
  answerSheet: z.boolean().default(true),
  questionTypes: z.array(z.string()).max(10).default(["Открытый вопрос"]),
  style: z.string().max(80).default("Космос"),
  language: z.string().max(80).default("Русский"),
});
export type GeneratorInput = z.infer<typeof generatorSchema>;
export const materialInput = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(toolTypes),
  subject: z.string().min(1).max(100),
  grade: z.number().int().min(1).max(11),
  contentJson: documentSchema,
  metadataJson: z.record(z.unknown()).default({}),
  status: z.enum(["draft", "ready"]).default("draft"),
  version: z.number().int().optional(),
});
export const passwordSchema = z
  .string()
  .min(10, "Минимум 10 символов")
  .max(128)
  .regex(/[a-zA-Zа-яА-Я]/, "Добавьте буквы")
  .regex(/[0-9]/, "Добавьте цифры");
export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((x) => x.toLowerCase()),
    password: passwordSchema,
    confirmPassword: z.string(),
    role: z.enum(["teacher", "student"]),
  })
  .refine((x) => x.password === x.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });
export type MaterialRecord = {
  id: string;
  title: string;
  type: ToolType;
  subject: string;
  grade: number;
  status: string;
  version: number;
  contentJson: DocumentContent;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
};
export function lessonDurations(total: number) {
  const weights = [0.05, 0.1, 0.3, 0.25, 0.15, 0.1, 0.05];
  const times = weights.map((x) => Math.floor(total * x));
  times[times.length - 1] += total - times.reduce((a, b) => a + b, 0);
  return times;
}
export function template(p: GeneratorInput): DocumentContent {
  const block = (
    title: string,
    body: string,
    extra: Partial<Section> = {},
  ): Section => ({ id: crypto.randomUUID(), title, body, ...extra });
  if (p.type === "lesson") {
    const times = lessonDurations(p.duration);
    return {
      demo: true,
      totalDuration: p.duration,
      sections: [
        block(
          "Общие сведения",
          `${p.subject} · ${p.grade} класс\nТема: ${p.title}\nТип: ${p.lessonType}\nЦель: ${p.goals || "Укажите цель урока"}\nПланируемые результаты: ${p.results || "Заполните ожидаемые результаты"}\nОборудование: ${p.equipment || "Укажите учебные материалы"}`,
        ),
        ...[
          "Организационный этап",
          "Актуализация знаний",
          "Изучение нового материала",
          "Закрепление",
          "Проверка понимания",
          "Рефлексия",
          "Домашнее задание",
        ].map((title, i) =>
          block(
            title,
            `Деятельность учителя: [заполните действия по теме «${p.title}»].\nДеятельность учащихся: [укажите действия и ожидаемый результат].`,
            { duration: times[i] },
          ),
        ),
      ],
    };
  }
  if (p.type === "presentation" || p.type === "video")
    return {
      demo: true,
      totalDuration: p.duration,
      sections: Array.from({ length: p.count }, (_, i) =>
        block(
          i === 0
            ? p.title
            : i === p.count - 1
              ? "Подведём итоги"
              : `Раздел ${i}: ${p.title}`,
          i === 0
            ? `${p.subject} · ${p.grade} класс\nДобавьте вступление и цель занятия.`
            : "Редактируемый шаблон. Добавьте основные тезисы, пример и вопрос для обсуждения.",
          {
            background:
              p.style === "Светлый"
                ? "#EDF3F7"
                : p.style === "Тёплый"
                  ? "#382A25"
                  : i % 2
                    ? "#111A30"
                    : "#080D1C",
            ...(p.type === "video"
              ? {
                  duration:
                    Math.floor((p.duration * 60) / p.count) +
                    (i === p.count - 1 ? (p.duration * 60) % p.count : 0),
                }
              : {}),
          },
        ),
      ),
    };
  if (p.type === "test" || p.type === "worksheet")
    return {
      demo: true,
      sections: Array.from({ length: p.count * p.variants }, (_, i) =>
        block(
          `${p.variants > 1 ? `Вариант ${Math.floor(i / p.count) + 1} · ` : ""}Задание ${(i % p.count) + 1}`,
          `[${p.questionTypes[i % p.questionTypes.length] || "Открытый вопрос"}]\nСоставьте задание по теме «${p.title}».`,
          {
            answer: p.answerSheet
              ? "Укажите правильный ответ и критерии оценивания."
              : "",
            points:
              Math.floor(p.maxScore / p.count) +
              (i % p.count === p.count - 1 ? p.maxScore % p.count : 0),
          },
        ),
      ),
    };
  if (p.type === "review")
    return {
      demo: false,
      sections: [
        "Содержание работы",
        "Найденные ошибки",
        "Комментарии",
        "Рекомендации",
        "Баллы по критериям",
        "Итоговый результат",
      ].map((title) =>
        block(
          title,
          title === "Итоговый результат"
            ? "Выставите балл вручную и подтвердите оценку."
            : "Заполните по результатам ручной проверки.",
        ),
      ),
    };
  return {
    demo: true,
    sections: [
      block(
        p.title,
        "Ключевые понятия\n\nОсновные тезисы\n\nПримеры\n\nВопросы для самопроверки",
      ),
    ],
  };
}
export function withoutAnswers<
  T extends { contentJson: unknown; metadataJson: unknown },
>(m: T): T {
  const c = documentSchema.parse(m.contentJson);
  return {
    ...m,
    contentJson: {
      ...c,
      sections: c.sections.map(({ answer, ...rest }) => rest),
    },
    metadataJson: {},
  };
}
