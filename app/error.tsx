"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Не удалось открыть страницу</h1>
      <p>Попробуйте ещё раз. Ваши сохранённые данные остаются в аккаунте.</p>
      <button className="button primary" onClick={reset}>
        Повторить
      </button>
    </main>
  );
}
