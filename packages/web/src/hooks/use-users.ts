import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { users as usersApi } from '@/lib/api';
import type { UpdateProfilePayload } from '@/lib/api';

export const userKeys = {
  all: ['users'] as const,
  detail: (nickname: string) => [...userKeys.all, nickname] as const,
  ratings: (nickname: string) => [...userKeys.all, nickname, 'ratings'] as const,
};

export function useUser(nickname: string) {
  return useQuery({
    queryKey: userKeys.detail(nickname),
    queryFn: () => usersApi.getUser(nickname),
    enabled: !!nickname,
  });
}

export function useUserRatings(nickname: string, page = 1) {
  return useQuery({
    queryKey: [...userKeys.ratings(nickname), page],
    queryFn: () => usersApi.getUserRatings(nickname, page),
    enabled: !!nickname,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => usersApi.updateProfile(payload),
    onSuccess: (updated) => {
      qc.setQueryData(userKeys.detail(updated.nickname), updated);
    },
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all });
    },
  });
}
