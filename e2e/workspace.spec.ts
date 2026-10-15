import { test, expect } from "@playwright/test";
test("регистрация, материал, автосохранение, экспорт, чат и мобильное меню", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /У каждой идеи/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "../work/edupilot-landing.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await page.getByLabel("Имя", { exact: true }).fill("Анна");
  await page.getByLabel("Фамилия", { exact: true }).fill("Тестовая");
  await page
    .getByLabel("Электронная почта")
    .fill(`e2e-${Date.now()}@test.example`);
  await page.getByLabel("Пароль", { exact: true }).fill("ExamplePass789!");
  await page.getByLabel("Повторите пароль").fill("ExamplePass789!");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Открывайте новые/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "../work/edupilot-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /План урока От идеи/ }).click();
  await page.getByLabel("Тема / название").fill("Обыкновенные дроби");
  await page
    .getByRole("button", { name: "Создать структуру", exact: true })
    .click();
  await expect(page.getByLabel("Название материала")).toHaveValue(
    "Обыкновенные дроби",
  );
  await page
    .getByLabel("Содержание раздела 1", { exact: true })
    .fill("Материал проверен и отредактирован преподавателем.");
  await expect(
    page.getByText("Сохранено в аккаунте", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Содержание раздела 1", { exact: true }),
  ).toHaveValue("Материал проверен и отредактирован преподавателем.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "DOCX", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".docx");
  await page
    .getByRole("button", { name: "Новый чат", exact: false })
    .first()
    .click();
  await page.getByLabel("Сообщение EduPilot").fill("Объясни дроби");
  await page
    .getByRole("button", { name: "Отправить сообщение", exact: true })
    .click();
  await expect(
    page.getByText("Как складывать дроби", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: /Открывайте новые/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Открыть меню", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Мои материалы", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "../work/edupilot-mobile.png",
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});
