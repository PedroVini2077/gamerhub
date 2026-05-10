import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useRealtime(table, callback) {
  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [table]);
}
