export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    credentials: "same-origin",
    headers:
      body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...(body !== undefined
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  const data: any = await response
    .json()
    .catch(() => ({ error: "Сервер вернул некорректный ответ." }));
  if (!response.ok)
    throw new Error(data.error || "Не удалось выполнить запрос");
  return data;
}
