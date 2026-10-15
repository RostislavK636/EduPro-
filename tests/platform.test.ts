import { beforeAll, afterAll, describe, it, expect } from "vitest";
import fs from "node:fs";
import Database from "better-sqlite3";
import JSZip from "jszip";
import { GET, POST, PATCH, DELETE } from "../app/api/[...path]/route";
import { db } from "../lib/database";
import {
  generatorSchema,
  template,
  lessonDurations,
  withoutAnswers,
} from "../lib/domain";
import { hashPassword, verifyPassword } from "../lib/security";
const file = `prisma/test-${process.pid}.db`;
process.env.DATABASE_URL = "file:./" + file;
process.env.AI_MODE = "mock";
const origin = "http://127.0.0.1:3000";
let teacher = "",
  student = "",
  outsider = "",
  materialId = "",
  classId = "",
  assignmentId = "",
  studentId = "";
async function call(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
  customOrigin = origin,
) {
  const req = new Request(origin + "/api/" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: customOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return ({ GET, POST, PATCH, DELETE } as any)[method](
    req,
  ) as Promise<Response>;
}
async function create(role: string, email: string) {
  const r = await call("auth/register", "POST", {
    firstName: "Тест",
    lastName: "Пользователь",
    email,
    password: "ExamplePass789!",
    confirmPassword: "ExamplePass789!",
    role,
  });
  expect(r.status).toBe(201);
  const data: any = await r.json();
  expect(data.user.passwordHash).toBeUndefined();
  return {
    cookie: r.headers.get("set-cookie")!.split(";")[0],
    id: data.user.id,
  };
}
beforeAll(() => {
  const database = new Database(file);
  database.exec(
    fs.readFileSync(
      "prisma/migrations/202610150001_init/migration.sql",
      "utf8",
    ),
  );
  database.exec(
    fs.readFileSync(
      "prisma/migrations/202610150002_quiz_sessions/migration.sql",
      "utf8",
    ),
  );
  database.close();
});
afterAll(async () => {
  await (await db()).$disconnect();
  fs.rmSync(file, { force: true });
});
describe("Критические операции EduPilot", () => {
  it("хеширует Argon2id с солью и проверяет пароль", async () => {
    const a = await hashPassword("GoodPassword123");
    const b = await hashPassword("GoodPassword123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("GoodPassword123", a)).toBe(true);
    expect(await verifyPassword("WrongPassword123", a)).toBe(false);
  });
  it("защищает приватные данные и CSRF", async () => {
    expect((await call("materials")).status).toBe(401);
    expect(
      (await call("auth/register", "POST", {}, "", "https://evil.example"))
        .status,
    ).toBe(403);
    expect((await call("auth/register", "POST", { email: "bad" })).status).toBe(
      400,
    );
  });
  it("регистрирует изолированные аккаунты", async () => {
    teacher = (await create("teacher", "teacher@test.example")).cookie;
    const s = await create("student", "student@test.example");
    student = s.cookie;
    studentId = s.id;
    outsider = (await create("teacher", "outsider@test.example")).cookie;
    const session: any = await (
      await call("session", "GET", undefined, teacher)
    ).json();
    expect(session.user.role).toBe("teacher");
    expect(session.ai.mode).toBe("mock");
  });
  it("создаёт шаблон урока с правильным временем, сохраняет и изолирует", async () => {
    const p = generatorSchema.parse({
      type: "lesson",
      title: "Обыкновенные дроби",
      subject: "Математика",
      grade: 7,
      duration: 45,
    });
    expect(lessonDurations(45).reduce((a, b) => a + b, 0)).toBe(45);
    const r = await call(
      "materials",
      "POST",
      {
        title: p.title,
        type: p.type,
        subject: p.subject,
        grade: p.grade,
        contentJson: template(p),
      },
      teacher,
    );
    expect(r.status).toBe(201);
    const m: any = await r.json();
    materialId = m.id;
    expect(
      (await call("materials/" + materialId, "GET", undefined, outsider))
        .status,
    ).toBe(404);
    expect(
      (await call("materials/" + materialId, "DELETE", undefined, outsider))
        .status,
    ).toBe(404);
  });
  it("сохраняет правки и отклоняет конфликт версии", async () => {
    const m: any = await (
      await call("materials/" + materialId, "GET", undefined, teacher)
    ).json();
    const r = await call(
      "materials/" + materialId,
      "PATCH",
      { ...m, title: "Дроби — новый заголовок" },
      teacher,
    );
    expect(r.status).toBe(200);
    expect(
      (await call("materials/" + materialId, "PATCH", m, teacher)).status,
    ).toBe(409);
  });
  it("экспортирует настоящие DOCX, PDF и PPTX с кириллицей", async () => {
    for (const format of ["docx", "pdf", "pptx"]) {
      const r = await call(
        `materials/${materialId}/export?format=${format}`,
        "GET",
        undefined,
        teacher,
      );
      expect(r.status).toBe(200);
      const b = Buffer.from(await r.arrayBuffer());
      if (format === "pdf") {
        expect(b.subarray(0, 5).toString()).toBe("%PDF-");
      } else {
        const zip = await JSZip.loadAsync(b);
        expect(zip.file("[Content_Types].xml")).toBeTruthy();
        if (format === "docx")
          expect(
            await zip.file("word/document.xml")!.async("string"),
          ).toContain("Дроби");
        else expect(zip.file("ppt/presentation.xml")).toBeTruthy();
      }
    }
  });
  it("сохраняет чат и помечает демо-ответ", async () => {
    const chat: any = await (await call("chats", "POST", {}, teacher)).json();
    const r = await call(
      `chats/${chat.id}/message`,
      "POST",
      { content: "Объясни дроби" },
      teacher,
    );
    expect(r.status).toBe(200);
    const answer: any = await r.json();
    expect(answer.demo).toBe(true);
    expect(answer.content).toContain("Демонстрационный ответ");
    const stored: any = await (
      await call("chats/" + chat.id, "GET", undefined, teacher)
    ).json();
    expect(stored.messages).toHaveLength(2);
    expect(
      (await call("chats/" + chat.id, "GET", undefined, student)).status,
    ).toBe(404);
  });
  it("не позволяет ученику создавать классы и проверять работы", async () => {
    expect(
      (
        await call(
          "classes",
          "POST",
          { name: "7 А", subject: "Математика" },
          student,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          "generate",
          "POST",
          { type: "review", title: "Работа", subject: "Математика", grade: 7 },
          student,
        )
      ).status,
    ).toBe(403);
  });
  it("создаёт класс, одноразовое приглашение и задание", async () => {
    const c: any = await (
      await call(
        "classes",
        "POST",
        { name: "7 А", subject: "Математика" },
        teacher,
      )
    ).json();
    classId = c.id;
    const invite: any = await (
      await call(`classes/${classId}/invite`, "POST", {}, teacher)
    ).json();
    expect(
      (await call("classes/join", "POST", { code: invite.id }, student)).status,
    ).toBe(200);
    expect(
      (await call("classes/join", "POST", { code: invite.id }, student)).status,
    ).toBe(400);
    const a: any = await (
      await call(
        `classes/${classId}/assignment`,
        "POST",
        { title: "Изучить дроби", materialId },
        teacher,
      )
    ).json();
    assignmentId = a.id;
    expect(
      (await call(`classes/${classId}`, "GET", undefined, outsider)).status,
    ).toBe(404);
  });
  it("скрывает ответы и не разрешает редактирование материала учителя", async () => {
    const m: any = await (
      await call("materials/" + materialId, "GET", undefined, teacher)
    ).json();
    m.contentJson.sections[0].answer = "Секретный ключ";
    expect(
      (await call("materials/" + materialId, "PATCH", m, teacher)).status,
    ).toBe(200);
    const shared: any = await (
      await call("materials/" + materialId, "GET", undefined, student)
    ).json();
    expect(shared.canEdit).toBe(false);
    expect(JSON.stringify(shared)).not.toContain("Секретный ключ");
    expect(
      (await call("materials/" + materialId, "PATCH", shared, student)).status,
    ).toBe(403);
  });
  it("принимает работу, сохраняет ручную оценку и показывает только свой результат", async () => {
    const r = await call(
      `classes/${classId}/submit`,
      "POST",
      { assignmentId, text: "Мой ответ" },
      student,
    );
    expect(r.status).toBe(200);
    const s: any = await r.json();
    expect(
      (
        await call(
          `classes/${classId}/grade`,
          "POST",
          {
            submissionId: s.id,
            score: 8,
            maxScore: 10,
            teacherComment: "Хорошо",
          },
          teacher,
        )
      ).status,
    ).toBe(200);
    const school: any = await (
      await call("classes/" + classId, "GET", undefined, student)
    ).json();
    expect(school.assignments[0].submissions[0].grade.score).toBe(8);
  });
  it("сохраняет тему между сессиями, выполняет выход и повторный вход", async () => {
    expect(
      (await call("settings", "PATCH", { theme: "light" }, teacher)).status,
    ).toBe(200);
    expect((await call("auth/logout", "POST", {}, teacher)).status).toBe(200);
    expect((await call("materials", "GET", undefined, teacher)).status).toBe(
      401,
    );
    const login = await call("auth/login", "POST", {
      email: "teacher@test.example",
      password: "ExamplePass789!",
    });
    expect(login.status).toBe(200);
    teacher = login.headers.get("set-cookie")!.split(";")[0];
    const s: any = await (
      await call("session", "GET", undefined, teacher)
    ).json();
    expect(s.user.settings.theme).toBe("light");
    const list: any = await (
      await call("materials", "GET", undefined, teacher)
    ).json();
    expect(list.some((m: any) => m.id === materialId)).toBe(true);
  });
  it("ограничивает тест серверной сессией и не принимает повторную отправку", async () => {
    const r = await call(
      "materials",
      "POST",
      {
        title: "Тест на сложение",
        type: "test",
        subject: "Математика",
        grade: 5,
        contentJson: {
          demo: false,
          sections: [
            {
              id: "q1",
              title: "Вопрос 1",
              body: "2 + 2 = ?",
              options: ["3", "4", "5"],
              answer: "4",
              points: 2,
            },
          ],
        },
      },
      teacher,
    );
    expect(r.status).toBe(201);
    const m: any = await r.json();
    const q: any = await (
      await call("materials/" + m.id + "/quiz-start", "POST", {}, teacher)
    ).json();
    const result = await call(
      "materials/" + m.id + "/quiz",
      "POST",
      { sessionId: q.sessionId, answers: { q1: "4" } },
      teacher,
    );
    expect(result.status).toBe(200);
    expect(((await result.json()) as any).score).toBe(2);
    expect(
      (
        await call(
          "materials/" + m.id + "/quiz",
          "POST",
          { sessionId: q.sessionId, answers: { q1: "4" } },
          teacher,
        )
      ).status,
    ).toBe(422);
    expect(
      (await call("materials/" + m.id + "/quiz-start", "POST", {}, student))
        .status,
    ).toBe(404);
  });
  it("проверяет сигнатуру файла и изолирует приватное вложение", async () => {
    const invalid = new FormData();
    invalid.set(
      "file",
      new File(["MZ invalid"], "fake.png", { type: "image/png" }),
    );
    const bad = await POST(
      new Request(origin + "/api/files", {
        method: "POST",
        headers: { Origin: origin, Cookie: teacher },
        body: invalid,
      }),
    );
    expect(bad.status).toBe(415);
    const valid = new FormData();
    valid.set(
      "file",
      new File(
        [
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6xQAAAAASUVORK5CYII=",
            "base64",
          ),
        ],
        "pixel.png",
        { type: "image/png" },
      ),
    );
    const uploaded = await POST(
      new Request(origin + "/api/files", {
        method: "POST",
        headers: { Origin: origin, Cookie: teacher },
        body: valid,
      }),
    );
    expect(uploaded.status).toBe(201);
    const f: any = await uploaded.json();
    const material:any=await(await call('materials/'+materialId,'GET',undefined,teacher)).json();
    material.contentJson.sections[0].imageId=f.id;
    expect((await call('materials/'+materialId,'PATCH',material,teacher)).status).toBe(200);
    for(const format of ['docx','pdf','pptx']){
      const exported=await call('materials/'+materialId+'/export?format='+format,'GET',undefined,teacher);
      expect(exported.status).toBe(200);
      if(format==='pptx'){const zip=await JSZip.loadAsync(await exported.arrayBuffer());expect(Object.keys(zip.files).some(name=>name.startsWith('ppt/media/')&&name.endsWith('.png'))).toBe(true);}
    }
    expect(
      (await call("files/" + f.id, "GET", undefined, teacher)).status,
    ).toBe(200);
    expect(
      (await call("files/" + f.id, "GET", undefined, outsider)).status,
    ).toBe(404);
    expect(
      (await call("files/" + f.id, "DELETE", undefined, teacher)).status,
    ).toBe(200);
  });
});
