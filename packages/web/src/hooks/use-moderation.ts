import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { moderation } from '@/lib/api';
import type { ModerationStatus } from '@bartr/shared';

export const moderationKeys = {
  adminFlags: (filters?: object) => ['admin', 'flags', filters] as const,
  myFlags: () => ['flags', 'mine'] as const,
};

export function useSubmitFlag() {
  return useMutation({
    mutationFn: moderation.submitFlag,
  });
}

export function useAdminFlags(filters: { status?: ModerationStatus; type?: string; page?: number } = {}) {
  return useQuery({
    queryKey: moderationKeys.adminFlags(filters),
    queryFn: () => moderation.getAdminFlags(filters),
  });
}

export function useUpdateFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ModerationStatus }) =>
      moderation.updateFlag(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'flags'] });
    },
  });
}
