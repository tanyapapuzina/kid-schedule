import { apiRequest } from '@/shared/api/client';
import type { FamilyJoinCode } from '@/shared/types/family';

export async function createFamilyJoinCode(
  familyId: number,
  familyMemberId: number,
): Promise<FamilyJoinCode> {
  return apiRequest<FamilyJoinCode>(`/family-codes/families/${familyId}/members/${familyMemberId}`, {
    method: 'POST',
  });
}
