import {
  clearTokenPair,
  getAccessToken,
  getRefreshToken,
  setTokenPair,
} from '@/shared/storage/tokenStorage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.kid-schedule.ru';

type ApiRequestOptions = RequestInit & {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

let refreshTokenPromise: Promise<boolean> | null = null;

// apiRequest это функция, которая выполняет HTTP-запрос к API с использованием Fetch API.
// Она принимает путь к ресурсу и опции запроса, включая возможность указать,
// требуется ли аутентификация (auth). Функция возвращает Promise<TResponse>,
// что означает, что она выполняется асинхронно и возвращает данные типа TResponse.
export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const { auth = true, retryOnUnauthorized = true, headers, ...requestOptions } = options;
  const response = await sendRequest(path, requestOptions, headers, auth);

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const didRefreshToken = await refreshAccessToken();

    if (didRefreshToken) {
      const retryResponse = await sendRequest(path, requestOptions, headers, auth);
      return parseResponse<TResponse>(retryResponse);
    }
  }

  return parseResponse<TResponse>(response);
}

async function sendRequest(
  path: string,
  requestOptions: RequestInit,
  headers: RequestInit['headers'],
  auth: boolean,
): Promise<Response> {
  const token = auth ? await getAccessToken() : null;

  return fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
}

async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || `API request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshTokenPromise) {
    return refreshTokenPromise;
  }

  refreshTokenPromise = performRefreshAccessToken();

  try {
    return await refreshTokenPromise;
  } finally {
    refreshTokenPromise = null;
  }
}

async function performRefreshAccessToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    await clearTokenPair();
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/mobile/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      await clearTokenPair();
      return false;
    }

    const tokenPair = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };

    await setTokenPair(tokenPair.access_token, tokenPair.refresh_token);
    return true;
  } catch {
    await clearTokenPair();
    return false;
  }
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
