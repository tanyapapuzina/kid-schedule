import { apiRequest } from '@/shared/api/client';
import { clearAccessToken, setAccessToken } from '@/shared/storage/tokenStorage';
import type {
  CurrentSession,
  MessageResponse,
  MobileTokenResponse,
  ParentProfile,
  RegisterResponse,
} from '@/shared/types/auth';

type ParentLoginPayload = {
  email: string;
  password: string;
};

type CodeLoginPayload = {
  code: string;
};

type RegisterParentPayload = {
  email: string;
  password: string;
  name?: string;
};

type ConfirmParentPayload = {
  email: string;
  pin_code: string;
};

type PasswordResetRequestPayload = {
  email: string;
};

type PasswordResetConfirmPayload = {
  email: string;
  pin_code: string;
  new_password: string;
};

export async function loginParent(payload: ParentLoginPayload): Promise<CurrentSession> {
  const tokenResponse = await apiRequest<MobileTokenResponse>('/mobile/auth/login', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });

  await setAccessToken(tokenResponse.access_token);
  return getCurrentSession();
}

export async function loginFamilyMemberByCode(payload: CodeLoginPayload): Promise<CurrentSession> {
  const tokenResponse = await apiRequest<MobileTokenResponse>('/mobile/auth/code-login', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });

  await setAccessToken(tokenResponse.access_token);
  return getCurrentSession();
}

export async function registerParent(payload: RegisterParentPayload): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmParentRegistration(payload: ConfirmParentPayload): Promise<ParentProfile> {
  return apiRequest<ParentProfile>('/auth/confirm', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resendRegistrationPin(
  payload: PasswordResetRequestPayload,
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/resend-pin', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordReset(
  payload: PasswordResetRequestPayload,
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/password-reset', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function confirmPasswordReset(
  payload: PasswordResetConfirmPayload,
): Promise<ParentProfile> {
  return apiRequest<ParentProfile>('/auth/password-reset/confirm', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resendPasswordResetPin(
  payload: PasswordResetRequestPayload,
): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/password-reset/resend', {
    auth: false,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getCurrentSession(): Promise<CurrentSession> {
  return apiRequest<CurrentSession>('/auth/session');
}

export async function logout(): Promise<void> {
  await clearAccessToken();
}
