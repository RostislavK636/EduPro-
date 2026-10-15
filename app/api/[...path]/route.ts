import { z } from "zod";
import { db } from "@/lib/database";
import {
  csrf,
  readJson,
  currentUser,
  requireUser,
  publicUser,
  hashPassword,
  verifyPassword,
  rateLimit,
  sessionCookie,
  clearCookie,
  fail,
  HttpError,
  digest,
  token,
} from "@/lib/security";
import {
  registerSchema,
  passwordSchema,
  materialInput,
  generatorSchema,
  documentSchema,
  withoutAnswers,
} from "@/lib/domain";
import { aiStatus, getProvider } from "@/lib/ai";
import { storage } from "@/lib/storage";
import { exportMaterial } from "@/lib/export";
export const dynamic = "force-dynamic";
const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
async function handle(req: Request) {
  try {
    csrf(req);
    const parts = new URL(req.url).pathname.split("/").slice(2).filter(Boolean);
    const [area, id, action] = parts;
    const method = req.method;
    const client = await db();
    if (area === "session" && method === "GET") {
      const user = await currentUser(req);
      return json({ user: user ? publicUser(user) : null, ai: aiStatus() });
    }
    if (area === "auth") {
      const ip =
        req.headers.get("cf-connecting-ip") ||
        req.headers.get("x-forwarded-for")?.split(",")[0] ||
        "local";
      await rateLimit(`auth-ip:${ip}`, 30, 900);
      if (id === "register" && method === "POST") {
        const data = registerSchema.parse(await readJson(req));
        await rateLimit(`auth-email:${await digest(data.email)}`, 10, 900);
        if (await client.user.findUnique({ where: { email: data.email } }))
          fail(409, "Этот email уже зарегистрирован.");
        const user = await client.user.create({
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            role: data.role,
            passwordHash: await hashPassword(data.password),
          },
        });
        await client.userSettings.create({ data: { userId: user.id } });
        return json({ user: publicUser(user) }, 201, {
          "Set-Cookie": await sessionCookie(user.id, req),
        });
      }
      if (id === "login" && method === "POST") {
        const data = z
          .object({
            email: z
              .string()
              .email()
              .transform((x) => x.toLowerCase().trim()),
            password: z.string().max(128),
          })
          .parse(await readJson(req));
        await rateLimit(`auth-email:${await digest(data.email)}`, 10, 900);
        const user = await client.user.findUnique({
          where: { email: data.email },
        });
        const valid = await verifyPassword(
          data.password,
          user?.passwordHash ||
            "argon2id$00000000000000000000000000000000$" + "".padEnd(64, "0"),
        );
        if (!user || !valid) fail(401, "Неверный email или пароль.");
        return json({ user: publicUser(user) }, 200, {
          "Set-Cookie": await sessionCookie(user.id, req),
        });
      }
      if (id === "logout" && method === "POST") {
        const user = await requireUser(req);
        const raw = req.headers
          .get("cookie")
          ?.match(/(?:^|;\s*)edupilot_session=([^;]+)/)?.[1];
        if (raw)
          await client.session.deleteMany({
            where: { id: await digest(raw), userId: user.id },
          });
        return json({ ok: true }, 200, { "Set-Cookie": clearCookie });
      }
    }
    const user = await requireUser(req);
    await rateLimit(`request:${user.id}`, 240, 60);
    const teacher = () => {
      if (user.role !== "teacher") fail(403, "Доступно только преподавателям.");
    };
    if (area === "settings" && method === "PATCH") {
      const body = z
        .object({
          firstName: z.string().min(1).max(80).optional(),
          lastName: z.string().min(1).max(80).optional(),
          theme: z.enum(["dark", "light"]).optional(),
          preferredSubject: z.string().max(100).optional(),
          preferredGrade: z.number().int().min(1).max(11).optional(),
          preferences: z.record(z.unknown()).optional(),
        })
        .parse(await readJson(req));
      const { firstName, lastName, ...settings } = body;
      await client.user.update({
        where: { id: user.id },
        data: { firstName, lastName },
      });
      await client.userSettings.upsert({
        where: { userId: user.id },
        create: { userId: user.id, ...settings } as any,
        update: settings as any,
      });
      return json({ ok: true });
    }
    if (area === "password" && method === "POST") {
      const body = z
        .object({
          currentPassword: z.string().max(128),
          password: passwordSchema,
        })
        .parse(await readJson(req));
      await rateLimit(`password:${user.id}`, 5, 900);
      if (!(await verifyPassword(body.currentPassword, user.passwordHash)))
        fail(400, "Текущий пароль указан неверно.");
      await client.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(body.password) },
      });
      await client.session.deleteMany({ where: { userId: user.id } });
      return json({ ok: true }, 200, {
        "Set-Cookie": await sessionCookie(user.id, req),
      });
    }
    if (area === "generate" && method === "POST") {
      await rateLimit(`ai:${user.id}`, 20, 3600);
      const data = generatorSchema.parse(await readJson(req));
      if (data.type === "review") teacher();
      return json({
        content: await getProvider().generateStructuredContent(data),
        mode: aiStatus().mode,
      });
    }
    if (area === "materials") {
      if (!id && method === "GET")
        return json(
          await client.material.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: "desc" },
          }),
        );
      if (!id && method === "POST") {
        const data = materialInput.parse(await readJson(req));
        if (data.type === "review") teacher();
        const { version, ...rest } = data;
        return json(
          await client.material.create({
            data: {
              ...rest,
              userId: user.id,
              contentJson: rest.contentJson as any,
              metadataJson: rest.metadataJson as any,
            },
          }),
          201,
        );
      }
      const material = await client.material.findUnique({ where: { id } });
      if (!material) fail(404, "Материал не найден.");
      const own = material.userId === user.id;
      if (!own) {
        const assignment = await client.assignment.findFirst({
          where: {
            materialId: id,
            class: { enrollments: { some: { studentId: user.id } } },
          },
        });
        if (!assignment) fail(404, "Материал не найден.");
        if (method !== "GET" && !["quiz", "quiz-start"].includes(action))
          fail(403, "Материал доступен только для чтения.");
      }
      if (action === "export" && method === "GET") {
        const format = new URL(req.url).searchParams.get("format") || "docx";
        if (!["docx", "pdf", "pptx"].includes(format))
          fail(400, "Неподдерживаемый формат.");
        const withAnswers =
          own &&
          user.role === "teacher" &&
          new URL(req.url).searchParams.get("answers") === "true";
        const safe = withAnswers ? material : withoutAnswers(material);
        const result = await exportMaterial(safe, format, withAnswers);
        return new Response(result.bytes as any, {
          headers: {
            "Content-Type": result.mime,
            "Content-Disposition": `attachment; filename="EduPilot.${format}"; filename*=UTF-8''${encodeURIComponent(material.title)}.${format}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (action === "quiz-start" && method === "POST") {
        if (material.type !== "test")
          fail(422, "Этот материал не является тестом.");
        const meta = material.metadataJson as any;
        const seconds = Math.min(
          14400,
          Math.max(300, Number(meta.duration || 45) * 60),
        );
        const session = await client.quizSession.create({
          data: {
            id: token(),
            userId: user.id,
            materialId: id,
            expiresAt: new Date(Date.now() + seconds * 1000),
          },
        });
        return json({ sessionId: session.id, expiresAt: session.expiresAt });
      }
      if (action === "quiz" && method === "POST") {
        const body = z
          .object({
            answers: z.record(z.string().max(5000)),
            sessionId: z.string(),
          })
          .parse(await readJson(req));
        if (material.type !== "test") fail(422, "Материал не является тестом.");
        const quiz = await client.quizSession.findFirst({
          where: {
            id: body.sessionId,
            userId: user.id,
            materialId: id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!quiz) fail(422, "Попытка уже завершена или время теста истекло.");
        const content = documentSchema.parse(material.contentJson);
        const sections = content.sections.filter((x) => x.answer);
        if (!sections.length) fail(422, "У теста пока нет ключей ответов.");
        const result = sections.map((s) => ({
          id: s.id,
          correct:
            (body.answers[s.id] || "").trim().toLowerCase() ===
            (s.answer || "").trim().toLowerCase(),
          answer: s.answer,
          points: s.points || 1,
        }));
        const maxScore = result.reduce((a, s) => a + s.points, 0);
        const score = result.reduce(
          (a, s) => a + (s.correct ? s.points : 0),
          0,
        );
        const consumed = await client.quizSession.updateMany({
          where: { id: quiz.id, usedAt: null, expiresAt: { gt: new Date() } },
          data: { usedAt: new Date() },
        });
        if (!consumed.count) fail(409, "Попытка уже завершена.");
        await client.quizAttempt.create({
          data: {
            userId: user.id,
            materialId: id,
            score,
            answersJson: { answers: body.answers, result, maxScore } as any,
          },
        });
        return json({ result, score, maxScore });
      }
      if (action === "duplicate" && method === "POST") {
        if (!own) fail(403, "Нет доступа.");
        return json(
          await client.material.create({
            data: {
              userId: user.id,
              title: material.title + " — копия",
              type: material.type,
              subject: material.subject,
              grade: material.grade,
              contentJson: material.contentJson as any,
              metadataJson: material.metadataJson as any,
            },
          }),
          201,
        );
      }
      if (method === "GET")
        return json({
          ...(own ? material : withoutAnswers(material)),
          canEdit: own,
        });
      if (!own) fail(403, "Нет доступа.");
      if (method === "PATCH") {
        const data = materialInput.parse(await readJson(req));
        if (data.type !== material.type)
          fail(400, "Тип материала нельзя изменить.");
        const { version, ...rest } = data;
        if (!version) fail(400, "Не указана версия материала.");
        const result = await client.material.updateMany({
          where: { id, userId: user.id, version },
          data: {
            ...rest,
            contentJson: rest.contentJson as any,
            metadataJson: rest.metadataJson as any,
            version: { increment: 1 },
          },
        });
        if (!result.count)
          fail(
            409,
            "Материал изменён в другой вкладке. Скопируйте текст перед обновлением страницы.",
          );
        return json(await client.material.findUnique({ where: { id } }));
      }
      if (method === "DELETE") {
        if (await client.assignment.count({ where: { materialId: id } }))
          fail(409, "Материал используется в задании класса.");
        await client.material.delete({ where: { id } });
        return json({ ok: true });
      }
    }
    if (area === "chats") {
      if (!id && method === "GET")
        return json(
          await client.chat.findMany({
            where: { userId: user.id },
            orderBy: { updatedAt: "desc" },
          }),
        );
      if (!id && method === "POST")
        return json(
          await client.chat.create({
            data: { title: "Новый диалог", userId: user.id },
          }),
          201,
        );
      const chat = await client.chat.findFirst({
        where: { id, userId: user.id },
      });
      if (!chat) fail(404, "Диалог не найден.");
      if (method === "GET")
        return json({
          ...chat,
          messages: await client.message.findMany({
            where: { chatId: id },
            orderBy: { createdAt: "asc" },
          }),
        });
      if (method === "DELETE") {
        await client.chat.delete({ where: { id } });
        return json({ ok: true });
      }
      if (method === "PATCH") {
        const b = z
          .object({ title: z.string().min(1).max(150) })
          .parse(await readJson(req));
        return json(await client.chat.update({ where: { id }, data: b }));
      }
      if (action === "message" && method === "POST") {
        await rateLimit(`ai:${user.id}`, 20, 3600);
        const body = z
          .object({
            content: z.string().min(1).max(12000),
            regenerate: z.boolean().default(false),
            attachmentIds: z.array(z.string()).max(5).default([]),
          })
          .parse(await readJson(req));
        const files = await client.fileAttachment.findMany({
          where: { id: { in: body.attachmentIds }, ownerId: user.id },
        });
        if (files.length !== body.attachmentIds.length)
          fail(403, "Вложение недоступно.");
        let messages = await client.message.findMany({
          where: { chatId: id },
          orderBy: { createdAt: "asc" },
        });
        if (!body.regenerate) {
          await client.message.create({
            data: {
              chatId: id,
              role: "user",
              content:
                body.content +
                (files.length
                  ? "\n\nВложения: " +
                    files.map((x) => '[' + x.originalName.replace(/[\[\]\\\r\n]/g,' ') + '](/api/files/' + x.id + ')').join(', ')
                  : ""),
            },
          });
          messages = await client.message.findMany({
            where: { chatId: id },
            orderBy: { createdAt: "asc" },
          });
        } else if (!messages.some((m) => m.role === "user"))
          fail(400, "Нет сообщения для повторной генерации.");
        if (body.regenerate)
          while (messages.at(-1)?.role === "assistant") messages.pop();
        const provider = getProvider();
        const content = await provider.generateText(
          messages.map((m) => ({ role: m.role, content: m.content })),
        );
        const answer = await client.message.create({
          data: { chatId: id, role: "assistant", content, demo: provider.demo },
        });
        await client.chat.update({
          where: { id },
          data: {
            title:
              chat.title === "Новый диалог"
                ? body.content.slice(0, 60)
                : chat.title,
            updatedAt: new Date(),
          },
        });
        return json(answer);
      }
    }
    if (area === "files") {
      if (!id && method === "POST") {
        const size = Number(req.headers.get("content-length"));
        if (size > 11000000) fail(413, "Максимальный размер файла — 10 МБ.");
        if (
          (await client.fileAttachment.count({
            where: { ownerId: user.id },
          })) >= 200
        )
          fail(422, "Достигнут лимит 200 вложений. Удалите ненужные.");
        const reader = req.body?.getReader();
        if (!reader) fail(400, "Файл не передан.");
        const chunks: Uint8Array[] = [];
        let total = 0;
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;
          total += value.byteLength;
          if (total > 11000000) {
            await reader!.cancel();
            fail(413, "Файл слишком большой.");
          }
          chunks.push(value);
        }
        const form = await new Response(Buffer.concat(chunks), {
          headers: { "Content-Type": req.headers.get("content-type") || "" },
        }).formData();
        const file = form.get("file");
        if (
          !(file instanceof File) ||
          file.size < 1 ||
          file.size > 10 * 1024 * 1024
        )
          fail(400, "Выберите файл до 10 МБ.");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const hex = Buffer.from(bytes.slice(0, 12)).toString("hex");
        let mime = "";
        if (hex.startsWith("89504e470d0a1a0a")) mime = "image/png";
        else if (hex.startsWith("ffd8ff")) mime = "image/jpeg";
        else if (
          Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
          Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
        )
          mime = "image/webp";
        else if (Buffer.from(bytes.slice(0, 5)).toString() === "%PDF-")
          mime = "application/pdf";
        else if (hex.startsWith("504b0304")) {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(bytes);
          const entry = zip.file("word/document.xml");
          const entries = Object.values(zip.files) as any[];
          if (
            entries.length > 500 ||
            entries.some((e) => e._data?.uncompressedSize > 15000000)
          )
            fail(413, "Слишком большой распакованный документ.");
          if (entry && zip.file("[Content_Types].xml"))
            mime =
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
        if (!mime)
          fail(
            415,
            "Поддерживаются PNG, JPG, WEBP, PDF и DOCX с корректным содержимым.",
          );
        const key = token();
        await storage().put(key, bytes, mime);
        try {
          return json(
            await client.fileAttachment.create({
              data: {
                ownerId: user.id,
                storageKey: key,
                originalName: file.name.slice(0, 200),
                mimeType: mime,
                size: file.size,
              },
            }),
            201,
          );
        } catch (e) {
          await storage().remove(key);
          throw e;
        }
      }
      const file = await client.fileAttachment.findFirst({
        where: { id, ownerId: user.id },
      });
      if (!file) fail(404, "Файл не найден.");
      if (method === "GET") {
        const bytes = await storage().get(file.storageKey);
        if (!bytes) fail(404, "Файл не найден в хранилище.");
        return new Response(bytes as any, {
          headers: {
            "Content-Type": file.mimeType,
            "Content-Disposition": `inline; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
            "Cache-Control": "private, no-store",
          },
        });
      }
      if (method === "DELETE") {
        await storage().remove(file.storageKey);
        await client.fileAttachment.delete({ where: { id } });
        return json({ ok: true });
      }
      if (action === "analyze" && method === "POST") {
        teacher();
        await rateLimit(`ai:${user.id}`, 20, 3600);
        const p = z
          .object({ prompt: z.string().max(5000) })
          .parse(await readJson(req));
        const bytes = await storage().get(file.storageKey);
        if (!bytes) fail(404, "Файл недоступен.");
        const provider = getProvider();
        if (file.mimeType.startsWith("image/"))
          return json({
            content: await provider.analyzeImage(
              `data:${file.mimeType};base64,${Buffer.from(bytes!).toString("base64")}`,
              p.prompt,
            ),
            preliminary: true,
          });
        if (file.mimeType.endsWith("wordprocessingml.document")) {
          const zip = await (await import("jszip")).default.loadAsync(bytes!);
          const text = (
            await zip.file("word/document.xml")!.async("string")
          ).replace(/<[^>]*>/g, " ");
          return json({
            content: await provider.analyzeDocument(text, p.prompt),
            preliminary: true,
          });
        }
        fail(
          422,
          "PDF можно просмотреть и проверить вручную. Серверный OCR/PDF-адаптер не подключён.",
        );
      }
    }
    if (area === "classes") {
      if (id === "join" && method === "POST") {
        if (user.role !== "student")
          fail(403, "Присоединиться может аккаунт ученика.");
        const body = z
          .object({ code: z.string().min(6).max(100) })
          .parse(await readJson(req));
        const invite = await client.classInvite.findUnique({
          where: { id: body.code.trim() },
        });
        if (!invite || invite.remaining < 1 || invite.expiresAt < new Date())
          fail(400, "Код недействителен или срок его действия истёк.");
        if (
          await client.enrollment.findUnique({
            where: {
              classId_studentId: {
                classId: invite.classId,
                studentId: user.id,
              },
            },
          })
        )
          fail(409, "Вы уже в этом классе.");
        const used = await client.classInvite.updateMany({
          where: {
            id: invite.id,
            remaining: { gt: 0 },
            expiresAt: { gt: new Date() },
          },
          data: { remaining: { decrement: 1 } },
        });
        if (!used.count) fail(409, "Код уже использован.");
        try {
          await client.enrollment.create({
            data: { classId: invite.classId, studentId: user.id },
          });
        } catch (e) {
          await client.classInvite.update({
            where: { id: invite.id },
            data: { remaining: { increment: 1 } },
          });
          throw e;
        }
        return json({ ok: true });
      }
      if (!id && method === "GET")
        return json(
          await client.schoolClass.findMany({
            where:
              user.role === "teacher"
                ? { teacherId: user.id }
                : { enrollments: { some: { studentId: user.id } } },
            include: {
              _count: { select: { enrollments: true, assignments: true } },
            },
          }),
        );
      if (!id && method === "POST") {
        teacher();
        const b = z
          .object({
            name: z.string().min(1).max(100),
            subject: z.string().min(1).max(100),
          })
          .parse(await readJson(req));
        return json(
          await client.schoolClass.create({
            data: { ...b, teacherId: user.id },
          }),
          201,
        );
      }
      const school = await client.schoolClass.findFirst({
        where: {
          id,
          ...(user.role === "teacher"
            ? { teacherId: user.id }
            : { enrollments: { some: { studentId: user.id } } }),
        },
      });
      if (!school) fail(404, "Класс не найден.");
      if (method === "GET") {
        const assignments = await client.assignment.findMany({
          where: { classId: id },
          include: {
            submissions: {
              where: user.role === "teacher" ? {} : { studentId: user.id },
              include: {
                grade: true,
                student: { select: { firstName: true, lastName: true } },
              },
            },
          },
        });
        const enrollments =
          user.role === "teacher"
            ? await client.enrollment.findMany({
                where: { classId: id },
                include: {
                  student: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                    },
                  },
                },
              })
            : [];
        return json({ ...school, assignments, enrollments });
      }
      if (action === "submit" && method === "POST") {
        if (user.role !== "student")
          fail(403, "Отправка работы доступна ученикам.");
        const b = z
          .object({
            assignmentId: z.string(),
            text: z.string().min(1).max(20000),
          })
          .parse(await readJson(req));
        const a = await client.assignment.findFirst({
          where: { id: b.assignmentId, classId: id },
        });
        if (!a) fail(404, "Задание не найдено.");
        if (a.dueDate && a.dueDate < new Date()) fail(422, "Срок сдачи истёк.");
        const existing = await client.submission.findUnique({
          where: {
            assignmentId_studentId: { assignmentId: a.id, studentId: user.id },
          },
          include: { grade: true },
        });
        if (existing?.grade)
          fail(
            409,
            "Работа уже оценена. Обсудите исправления с преподавателем.",
          );
        return json(
          await client.submission.upsert({
            where: {
              assignmentId_studentId: {
                assignmentId: a.id,
                studentId: user.id,
              },
            },
            create: {
              assignmentId: a.id,
              studentId: user.id,
              contentJson: { text: b.text },
            },
            update: { contentJson: { text: b.text }, submittedAt: new Date() },
          }),
        );
      }
      teacher();
      if (action === "invite" && method === "POST")
        return json(
          await client.classInvite.create({
            data: {
              id: token().slice(0, 12),
              classId: id,
              remaining: 1,
              expiresAt: new Date(Date.now() + 86400000),
            },
          }),
        );
      if (action === "student" && method === "DELETE") {
        const b = z
          .object({ studentId: z.string() })
          .parse(await readJson(req));
        await client.enrollment.deleteMany({
          where: { classId: id, studentId: b.studentId },
        });
        return json({ ok: true });
      }
      if (action === "assignment" && method === "POST") {
        const b = z
          .object({
            materialId: z.string(),
            title: z.string().min(1).max(200),
            dueDate: z.string().optional(),
          })
          .parse(await readJson(req));
        if (
          !(await client.material.findFirst({
            where: { id: b.materialId, userId: user.id },
          }))
        )
          fail(404, "Материал недоступен.");
        return json(
          await client.assignment.create({
            data: {
              classId: id,
              materialId: b.materialId,
              title: b.title,
              dueDate: b.dueDate ? new Date(b.dueDate) : null,
            },
          }),
          201,
        );
      }
      if (action === "grade" && method === "POST") {
        const b = z
          .object({
            submissionId: z.string(),
            score: z.number().min(0),
            maxScore: z.number().min(1).max(1000),
            teacherComment: z.string().max(5000),
          })
          .refine((x) => x.score <= x.maxScore, {
            message: "Балл превышает максимум",
          })
          .parse(await readJson(req));
        const s = await client.submission.findFirst({
          where: { id: b.submissionId, assignment: { classId: id } },
        });
        if (!s) fail(404, "Работа не найдена.");
        return json(
          await client.grade.upsert({
            where: { submissionId: s.id },
            create: { ...b, approvedAt: new Date() },
            update: { ...b, approvedAt: new Date() },
          }),
        );
      }
      if (method === "PATCH") {
        const b = z
          .object({ name: z.string().min(1).max(100) })
          .parse(await readJson(req));
        return json(
          await client.schoolClass.update({ where: { id }, data: b }),
        );
      }
    }
    if (area === "attempts" && method === "GET")
      return json(
        await client.quizAttempt.findMany({
          where: { userId: user.id },
          include: { material: { select: { title: true } } },
          orderBy: { createdAt: "desc" },
        }),
      );
    fail(404, "Маршрут не найден.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        { error: error.issues.map((x) => x.message).join("; ") },
        400,
      );
    const e = error as any;
    if (e.code === "P2002")
      return json({ error: "Такая запись уже существует." }, 409);
    console.error("EduPilot request failed", { name: e?.name, code: e?.code });
    return json(
      { error: "Не удалось выполнить операцию. Повторите попытку." },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
