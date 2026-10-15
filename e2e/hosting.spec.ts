import { test, expect } from "@playwright/test";
import { BANK } from '../lib/learning/bank';
test('Worker/D1: автономная тренировка и канонический журнал',async({request})=>{
  test.skip(!process.env.HOSTED_PREVIEW,'Отдельная локальная D1-база');const base=process.env.EDUPILOT_TEST_URL||'http://127.0.0.1:4173';const headers={Origin:base};
  const r=await request.post(base+'/api/auth/register',{headers,data:{firstName:'Демо',lastName:'Тренажёр',email:`learning-worker-${Date.now()}@test.example`,password:'ExamplePass789!',confirmPassword:'ExamplePass789!',role:'teacher'}});expect(r.status(),await r.text()).toBe(201);
  const create=await request.post(base+'/api/learning/sessions',{headers,data:{topic:'fractions'}});expect(create.status(),await create.text()).toBe(201);const s=await create.json();expect(s.turn.question.answer).toBeUndefined();const q=BANK.find(q=>q.id===s.turn.question.id)!;const data={turnId:s.turn.id,requestId:'worker-idempotent',answer:q.answer};const answer=await request.post(base+`/api/learning/sessions/${s.session.id}/answer`,{headers,data});expect(answer.status(),await answer.text()).toBe(200);expect((await answer.json()).count).toBe(1);
  expect((await request.post(base+`/api/learning/sessions/${s.session.id}/answer`,{headers,data})).status()).toBe(200);const p=await request.get(base+'/api/learning/progress');expect(p.status(),await p.text()).toBe(200);const progress=await p.json();expect(progress.metrics.total).toBe(1);expect(progress.attempts[0].masteryBefore).toBe(.5);expect(progress.attempts[0].masteryAfter).toBeCloseTo(2/3);expect(progress.attempts[0].evidenceJson.priorTopicAttempts).toBe(0);
});
test("D1, серверная авторизация, PDF и приватные файлы в Worker", async ({
  request,
}) => {
  test.skip(
    !process.env.HOSTED_PREVIEW,
    "Только для локального Worker на отдельной D1-базе",
  );
  const base = process.env.EDUPILOT_TEST_URL || "http://127.0.0.1:4173";
  const origin = { Origin: base };
  const register = await request.post(base + "/api/auth/register", {
    headers: origin,
    data: {
      firstName: "Тест",
      lastName: "Worker",
      email: `worker-${Date.now()}@test.example`,
      password: "ExamplePass789!",
      confirmPassword: "ExamplePass789!",
      role: "teacher",
    },
  });
  expect(register.status(), await register.text()).toBe(201);
  const generation = await request.post(base + "/api/generate", {
    headers: origin,
    data: {
      type: "lesson",
      title: "Проверка Worker",
      subject: "Математика",
      grade: 7,
    },
  });
  expect(generation.status(), await generation.text()).toBe(200);
  const { content } = await generation.json();
  const create = await request.post(base + "/api/materials", {
    headers: origin,
    data: {
      title: "Проверка Worker",
      type: "lesson",
      subject: "Математика",
      grade: 7,
      contentJson: content,
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const m = await create.json();
  for (const format of ["pdf", "docx", "pptx"]) {
    const exported = await request.get(
      base + `/api/materials/${m.id}/export?format=${format}`,
    );
    expect(exported.status()).toBe(200);
    expect((await exported.body()).length).toBeGreaterThan(1000);
  }
  const uploaded = await request.post(base + "/api/files", {
    headers: origin,
    multipart: {
      file: {
        name: "pixel.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6xQAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const f = await uploaded.json();
  expect((await request.get(base + "/api/files/" + f.id)).status()).toBe(200);
});
