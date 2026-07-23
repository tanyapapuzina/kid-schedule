import { getAccessToken } from '@/shared/storage/tokenStorage';

export const API_BASE_URL = 'http://127.0.0.1:8000';

type ApiRequestOptions = RequestInit & {
  auth?: boolean;
};

// apiRequest это функция, которая выполняет HTTP-запрос к API с использованием Fetch API.
// Она принимает путь к ресурсу и опции запроса, включая возможность указать,
// требуется ли аутентификация (auth). Функция возвращает Promise<TResponse>,
// что означает, что она выполняется асинхронно и возвращает данные типа TResponse.
export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { auth = true, headers, ...requestOptions } = options;
  const token = auth ? await getAccessToken() : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `API request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

async function readErrorMessage(response: Response): Promise<string | null> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    const data = JSON.parse(text) as { detail?: string | Array<{ msg?: string; loc?: Array<string | number> }> };

    if (typeof data.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      return data.detail
        .map((item) => {
          const location = item.loc?.join('.') ?? 'request';
          return `${location}: ${item.msg ?? 'Некорректное значение'}`;
        })
        .join('\n');
    }

    return text;
  } catch {
    return text;
  }
}
