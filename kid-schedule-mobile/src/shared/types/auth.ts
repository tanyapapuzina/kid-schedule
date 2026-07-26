export type ActorType = 'parent' | 'family_member';

export type CurrentSession = {
  actor_type: ActorType;
  id: number;
  name?: string | null;
  email?: string | null;
  nickname?: string | null;
  role?: 'parent' | 'child' | null;
  family_id?: number | null;
};

export type MobileTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
};

export type RegisterResponse = {
  message: string;
};

export type ParentProfile = {
  id: number;
  email: string;
  name?: string | null;
};

export type MessageResponse = {
  message: string;
};
