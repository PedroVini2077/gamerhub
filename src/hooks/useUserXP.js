import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export function useUserXP(userId) {
  const { data } = useQuery({
    queryKey: ['user_xp', userId],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_user_xp', { p_user_id: userId });
      return data ?? null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return data?.xp ?? null;
}
