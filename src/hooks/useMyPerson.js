import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useMyPerson() {
  return useQuery({
    queryKey: ['my-person'],
    queryFn: () => base44.auth.myPerson(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
