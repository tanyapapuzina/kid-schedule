import { apiRequest } from '@/shared/api/client';
import type {
  Family,
  FamilyCreatePayload,
  FamilyMember,
  FamilyMemberCreatePayload,
  FamilyMemberUpdatePayload,
} from '@/shared/types/family';

export async function listFamilies(): Promise<Family[]> {
  return apiRequest<Family[]>('/families/');
}

export async function getFamily(familyId: number): Promise<Family> {
  return apiRequest<Family>(`/families/${familyId}`);
}

export async function createFamily(payload: FamilyCreatePayload): Promise<Family> {
  return apiRequest<Family>('/families/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listFamilyMembers(familyId: number): Promise<FamilyMember[]> {
  return apiRequest<FamilyMember[]>(`/families/${familyId}/members`);
}

export async function createFamilyMember(
  familyId: number,
  payload: FamilyMemberCreatePayload,
): Promise<FamilyMember> {
  return apiRequest<FamilyMember>(`/families/${familyId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFamilyMember(
  familyId: number,
  memberId: number,
  payload: FamilyMemberUpdatePayload,
): Promise<FamilyMember> {
  return apiRequest<FamilyMember>(`/families/${familyId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function archiveFamilyMember(familyId: number, memberId: number): Promise<void> {
  await apiRequest<void>(`/families/${familyId}/members/${memberId}`, {
    method: 'DELETE',
  });
}
