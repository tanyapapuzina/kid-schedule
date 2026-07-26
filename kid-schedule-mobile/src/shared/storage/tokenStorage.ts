import * as SecureStore from 'expo-secure-store';


// GetAccessToken это функция, которая извлекает токен доступа из безопасного
// хранилища устройства с использованием библиотеки expo-secure-store. 
// Она возвращает Promise<string | null>, что означает, что она выполняется 
// асинхронно и возвращает либо строку токена, либо null, если токен не найден.
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

// SetAccessToken это функция, которая сохраняет токен доступа в безопасное 
// хранилище устройства с использованием библиотеки expo-secure-store. 
// Она принимает строку токена в качестве аргумента и возвращает Promise<void>,
//  что означает, что она выполняется асинхронно и не возвращает значения.
export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token); //
} //SetItemAsync - это метод из библиотеки expo-secure-store, 
// который сохраняет данные в безопасное хранилище устройства.

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function setTokenPair(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    setAccessToken(accessToken),
    setRefreshToken(refreshToken),
  ]);
}


// ClearAccessToken это функция, которая удаляет токен доступа из безопасного
// хранилища устройства с использованием библиотеки expo-secure-store. 
// Она возвращает Promise<void>, что означает, что она выполняется асинхронно 
// и не возвращает значения.
export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokenPair(): Promise<void> {
  await Promise.all([
    clearAccessToken(),
    clearRefreshToken(),
  ]);
}

const ACCESS_TOKEN_KEY = 'kid_schedule_access_token';
const REFRESH_TOKEN_KEY = 'kid_schedule_refresh_token';
// ACCESS_TOKEN_KEY - это константа, которая хранит ключ, используемый для
// доступа к токену в безопасном хранилище устройства. 
// Она используется в функциях getAccessToken, setAccessToken и clearAccessToken.
