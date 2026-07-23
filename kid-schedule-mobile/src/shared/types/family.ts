export type Family = {
  id: number;
  name: string;
  owner_parent_id: number;
  created_at: string;
};

export type FamilyMemberRole = 'parent' | 'child';

export type FamilyMember = {
  id: number;
  family_id: number;
  parent_id: number | null;
  nickname: string;
  role: FamilyMemberRole;
  color: string | null;
  created_by_parent_id: number;
  created_at: string;
  is_active: boolean;
  archived_at: string | null;
  archived_by_parent_id: number | null;
};

export type FamilyMemberCreatePayload = {
  nickname: string;
  role: FamilyMemberRole;
  color?: string | null;
};

export type FamilyMemberUpdatePayload = {
  nickname?: string;
  color?: string | null;
};

export type FamilyCreatePayload = {
  name: string;
  owner_nickname: string;
};

export type FamilyJoinCode = {
  code: string;
  expires_at: string;
  family_member_id: number;
};
