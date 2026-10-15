import { test, expect, type Page } from '@playwright/test';

async function register(page: Page, role: 'student' | 'teacher') {
  const response = await page.request.post('/api/auth/register', {
    headers: { Origin: 'http://127.0.0.1:3000' },
    data: { firstName: 'Учебный', lastName: 'Сценарий', email: `learning-${role}-${Date.now()}@test.example`, password: 'ExamplePass789!', confirmPassword: 'ExamplePass789!', role },
  });
  expect(response.status()).toBe(201);
}

// A lost feedback gate, an unpersisted session, or fabricated progress must break this flow.
test('ученик проходит 5 + 10 заданий, видит разбор перед следующим и сохраняет прогресс', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await register(page, 'student');
  await page.goto('/learning');
  await expect(page.getByRole('heading', { name: 'Учебная траектория', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Аналитика обучения', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Начать тренировку', exact: true }).click();
  await expect(page.getByTestId('learning-counter')).toContainText('0 / 15');
  await expect(page.getByTestId('learning-question')).toBeVisible();
  await expect(page.getByTestId('learning-feedback')).toHaveCount(0);
  await page.screenshot({path:'../work/learning-training.png',fullPage:true});
  await page.locator('.learning-question-card').screenshot({path:'../work/learning-question.png'});
  const firstPrompt = await page.getByTestId('learning-question').innerText();
  await page.getByLabel('Ваш ответ', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(page.getByTestId('learning-feedback')).toContainText('Правильный ответ:');
  await expect(page.getByTestId('learning-question')).toHaveText(firstPrompt);
  await expect(page.getByTestId('learning-feedback')).toContainText('Диагностика');
  await page.reload();
  await expect(page.getByTestId('learning-feedback')).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(page.getByTestId('learning-counter')).toContainText('1 / 15');
  await page.reload();
  await expect(page.getByTestId('learning-counter')).toContainText('1 / 15');
  for (let i = 1; i < 15; i++) {
    await page.getByLabel('Ваш ответ', { exact: true }).fill('0');
    await page.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
    await expect(page.getByTestId('learning-feedback')).toBeVisible();
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Тренировка завершена', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Мой прогресс', exact: true }).last().click();
  await expect(page.getByTestId('learning-accuracy')).toContainText('0 / 15');
  await expect(page.getByRole('heading', { name: 'Журнал решений', exact: true })).toBeVisible();
  await page.screenshot({path:'../work/learning-progress.png',fullPage:true});
  await page.locator('.learning-stats').screenshot({path:'../work/learning-metrics.png'});
  await page.locator('.learning-timeline li').first().screenshot({path:'../work/learning-decision.png'});
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('learning-accuracy')).toBeVisible();
  await page.screenshot({path:'../work/learning-mobile.png',fullPage:true});
  await expect.poll(()=>page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

// Publishing a generated draft without a teacher review or keeping approval after an edit is a bug.
test('учитель проверяет библиотеку черновиков и видит честную пустую аналитику', async ({ page }) => {
  await register(page, 'teacher');
  await page.goto('/learning/analytics');
  await expect(page.getByRole('heading', { name: 'Аналитика обучения', exact: true })).toBeVisible();
  await expect(page.getByText('Пока нет ответов учеников', { exact: true })).toBeVisible();
  await page.goto('/learning/library');
  await page.getByRole('button', { name: 'Создать AI-черновик', exact: true }).click();
  await expect(page.getByTestId('learning-task-editor')).toBeVisible();
  await expect(page.getByText('Демо-образец', { exact: true }).first()).toBeVisible();
  const editor = page.getByTestId('learning-task-editor');
  await editor.getByRole('button', { name: 'На проверку', exact: true }).click();
  await expect(editor.getByTestId('learning-task-status')).toHaveText('На проверке');
  await editor.getByLabel('Я проверил условие, ответ, критерии и объяснение').check();
  await editor.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await expect(editor.getByTestId('learning-task-status')).toHaveText('Одобрено');
  const question = JSON.parse(await editor.getByRole('textbox', { name: 'JSON задания', exact: true }).inputValue());
  question.prompt += ' Проверьте вычисления.';
  await editor.getByRole('textbox', { name: 'JSON задания', exact: true }).fill(JSON.stringify(question, null, 2));
  await editor.getByRole('button', { name: 'Сохранить правки в черновик', exact: true }).click();
  await expect(editor.getByTestId('learning-task-status')).toHaveText('Черновик');
  await page.screenshot({path:'../work/learning-library.png',fullPage:true});
});

test('тренировка доступна с reduced motion и выключенными частицами',async({page})=>{
  await register(page,'student');await page.emulateMedia({reducedMotion:'reduce'});
  expect((await page.request.patch('/api/settings',{headers:{Origin:'http://127.0.0.1:3000'},data:{preferences:{background:{density:0,distance:140,speed:0,color:'#64f5da',animated:false}}}})).status()).toBe(200);
  await page.goto('/learning');await page.getByRole('button',{name:'Начать тренировку',exact:true}).click();
  await expect(page.getByTestId('learning-question')).toBeVisible();await page.getByLabel('Ваш ответ',{exact:true}).fill('0');await page.getByRole('button',{name:'Проверить ответ',exact:true}).click();await expect(page.getByTestId('learning-feedback')).toBeVisible();
  expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const session=await(await page.request.get('/api/session')).json();expect(session.user.settings.preferences.background.animated).toBe(false);expect(session.user.settings.preferences.background.density).toBe(0);
});
